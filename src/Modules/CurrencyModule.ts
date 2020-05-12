import AbstractModule from "./AbstractModule";
import {pluralize} from "../Utilities/functions";
import * as util from "util";
import {ConfirmationFactory, ConfirmedEvent} from "./ConfirmationModule";
import ChannelEntity from "../Database/Entities/ChannelEntity";
import ChatterEntity from "../Database/Entities/ChatterEntity";
import PermissionSystem from "../Systems/Permissions/PermissionSystem";
import {Role} from "../Systems/Permissions/Role";
import Permission from "../Systems/Permissions/Permission";
import SettingsSystem from "../Systems/Settings/SettingsSystem";
import Setting, {SettingType} from "../Systems/Settings/Setting";
import Logger from "../Utilities/Logger";
import {inject} from "inversify";
import symbols from "../symbols";
import ChannelManager from "../Chat/ChannelManager";
import CommandSystem from "../Systems/Commands/CommandSystem";
import Command from "../Systems/Commands/Command";
import {CommandEventArgs} from "../Systems/Commands/CommandEvent";


class BankCommand extends Command {
    constructor(private confirmationFactory: ConfirmationFactory) {
        super("bank", "<give|give-all|take|take-all|balance|reset|reset-all>");

        this.addSubcommand("give", this.give);
        this.addSubcommand("give-all", this.giveAll);
        this.addSubcommand("take", this.take);
        this.addSubcommand("take-all", this.takeAll);
        this.addSubcommand("balance", this.balance);
        this.addSubcommand("bal", this.balance);
        this.addSubcommand("reset", this.reset);
        this.addSubcommand("reset-all", this.resetAll);
    }

    async give({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "bank give <user> <amount>",
            arguments: [
                {
                    value: {
                        type: "chatter",
                    },
                    required: true
                },
                {
                    value: {
                        type: "float",
                    },
                    required: true
                }
            ],
            permission: "currency.bank.give"
        });
        if (args === null) return;
        const [chatter, amount] = args as [ChatterEntity, number];

        try {
            await chatter.deposit(amount);
            await response.message("currency:give", {
                amount: await CurrencyModule.formatAmount(amount, msg.getChannel()),
                username: chatter.name
            });
        } catch (e) {
            await response.genericError();
            Logger.get().error("Failed to give money to chatter's bank account", {cause: e});
        }
    }

    async giveAll({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "bank give-all <amount>",
            arguments: [
                {
                    value: {
                        type: "float",
                    },
                    required: true
                }
            ],
            permission: "currency.bank.give-all"
        });
        if (args === null) return;
        const [amount] = args as [number];

        const onlyActive = msg.getChannel().getSettings().get("currency.only-active-all");
        const chatters: ChatterEntity[] = onlyActive ? msg.getChannel().getChatters() : await ChatterEntity.getAll({channel: msg.getChannel()});

        const ops = [];
        for (const chatter of chatters)
            ops.push(chatter.deposit(amount));

        try {
            await Promise.all(ops);
            await response.message("currency:give-all", {
                amount: await CurrencyModule.formatAmount(amount, msg.getChannel())
            });
        } catch (e) {
            await response.genericError();
            Logger.get().error("Failed to give amount to all chatter's accounts", {cause: e});
        }
    }

    async take({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "bank take <user> <amount>",
            arguments: [
                {
                    value: {
                        type: "chatter",
                    },
                    required: true
                },
                {
                    value: {
                        type: "float",
                    },
                    required: true
                }
            ],
            permission: "currency.bank.take"
        });
        if (args === null) return;
        const [chatter, amount] = args as [ChatterEntity, number];

        try {
            await chatter.withdraw(amount);
            await response.message("currency:take", {
                amount: await CurrencyModule.formatAmount(amount, msg.getChannel()),
                username: chatter.name
            });
        } catch (e) {
            await response.genericError();
            Logger.get().error("Failed to take money from chatter's bank account", {cause: e});
        }
    }

    async takeAll({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "bank take-all <amount>",
            arguments: [
                {
                    value: {
                        type: "float",
                    },
                    required: true
                }
            ],
            permission: "currency.bank.take-all"
        });
        if (args === null) return;
        const [amount] = args as [number];

        const onlyActive = msg.getChannel().getSettings().get("currency.only-active-all");
        const chatters: ChatterEntity[] = onlyActive ? msg.getChannel().getChatters() : await msg.getChannel().chatters();

        const ops = [];
        for (const chatter of chatters)
            ops.push(chatter.withdraw(amount));

        try {
            await Promise.all(ops);
            await response.message("currency.take-all", {
                amount: await CurrencyModule.formatAmount(amount, msg.getChannel())
            });
        } catch (e) {
            await response.genericError();
            Logger.get().error("Failed to take amount out of all chatter's accounts", {cause: e});
        }
    }

    async balance({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "bank balance <user>",
            arguments: [
                {
                    value: {
                        type: "chatter",
                    },
                    required: true
                }
            ],
            permission: "currency.bank.balance"
        });
        if (args === null) return;
        const [chatter] = args as [ChatterEntity];

        await response.message("currency:balance-other", {
            username: chatter.name,
            balance: await CurrencyModule.formatAmount(chatter.balance, msg.getChannel())
        });
    }

    async reset({event, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "bank reset <user>",
            arguments: [
                {
                    value: {
                        type: "chatter",
                    },
                    required: true
                }
            ],
            permission: "currency.bank.reset"
        });
        if (args === null) return;
        const [chatter] = args as [ChatterEntity];

        try {
            chatter.balance = 0;
            await chatter.save();
            await response.message("currency:reset.user", {
                username: chatter.name
            });
        } catch (e) {
            await response.genericError();
            Logger.get().error("Failed to reset chatter's bank account", {cause: e});
        }
    }

    async resetAll({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "bank reset-all",
            permission: "currency.bank.reset-all"
        });
        if (args === null) return;

        const confirmation = await this.confirmationFactory(msg, await response.translate("currency.reset.all-confirm"), 30);
        confirmation.addListener(ConfirmedEvent, async () => {
            try {
                const chatters: ChatterEntity[] = await ChatterEntity.getAll({channel: msg.getChannel()});
                const ops = [];
                for (const chatter of chatters) {
                    chatter.balance = 0;
                    ops.push(chatter.save());
                }
                await Promise.all(ops);
                await response.message("currency:reset.all");
            } catch (e) {
                await response.genericError();
                Logger.get().error("Unable to reset currency module", {cause: e});
            }
        });
        confirmation.run();
    }
}

class BalanceCommand extends Command {
    constructor() {
        super("balance", null, ["bal"]);
    }

    async execute({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "balance",
            permission: "currency.balance"
        });
        if (args === null) return;

        const balance = msg.getChatter().balance;
        await response.message("currency:balance", {
            username: msg.getChatter().name,
            balance: await CurrencyModule.formatAmount(balance, msg.getChannel())
        });
    }
}

class PayCommand extends Command {
    constructor() {
        super("pay", "<user> <amount>");
    }

    async execute({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "pay <user> <amount>",
            arguments: [
                {
                    value: {
                        type: "chatter",
                    },
                    required: true
                },
                {
                    value: {
                        type: "float",
                    },
                    required: true
                }
            ],
            permission: "currency.pay"
        });
        if (args === null) return;
        const [chatter, amount] = args as [ChatterEntity, number];

        const successful = await msg.getChatter().charge(amount);
        if (successful === false) {
            await response.message("currency:error.low-balance");
        } else if (successful === null) {
            await response.genericError();
        } else {
            await chatter.deposit(amount);
            await response.message("currency.pay", {
                username: chatter.name,
                amount: await CurrencyModule.formatAmount(amount, msg.getChannel())
            });
        }
    }
}

export default class CurrencyModule extends AbstractModule {
    constructor(
        @inject(symbols.ConfirmationFactory) private makeConfirmation: ConfirmationFactory,
        @inject(ChannelManager) private channelManager: ChannelManager
    ) {
        super(CurrencyModule.name);
    }

    static async getSingularName(channel: ChannelEntity): Promise<string> {
        return channel.getSetting<string>("currency.name.singular");
    }

    static async getPluralName(channel: ChannelEntity): Promise<string> {
        return channel.getSetting<string>("currency.name.plural");
    }

    static async formatAmount(amount: number, channel: ChannelEntity): Promise<string> {
        const singular = await this.getSingularName(channel);
        const plural = await this.getPluralName(channel);

        return util.format("%d %s", amount, pluralize(amount, singular, plural));
    }

    initialize(): void {
        const cmd = CommandSystem.getInstance();
        cmd.registerCommand(new BankCommand(this.makeConfirmation), this);
        cmd.registerCommand(new BalanceCommand(), this);
        cmd.registerCommand(new PayCommand(), this);

        const perm = PermissionSystem.getInstance();
        perm.registerPermission(new Permission("currency.pay", Role.NORMAL));
        perm.registerPermission(new Permission("currency.balance", Role.NORMAL));
        perm.registerPermission(new Permission("currency.bank.give", Role.MODERATOR));
        perm.registerPermission(new Permission("currency.bank.give-all", Role.MODERATOR));
        perm.registerPermission(new Permission("currency.bank.take", Role.MODERATOR));
        perm.registerPermission(new Permission("currency.bank.take-all", Role.MODERATOR));
        perm.registerPermission(new Permission("currency.bank.balance", Role.MODERATOR));
        perm.registerPermission(new Permission("currency.bank.reset", Role.MODERATOR));
        perm.registerPermission(new Permission("currency.bank.reset-all", Role.BROADCASTER));

        const settings = SettingsSystem.getInstance();
        settings.registerSetting(new Setting("currency.name.singular", "point", SettingType.STRING));
        settings.registerSetting(new Setting("currency.name.plural", "points", SettingType.STRING));
        settings.registerSetting(new Setting("currency.gain.online", "10", SettingType.FLOAT));
        settings.registerSetting(new Setting("currency.gain.offline", "2", SettingType.FLOAT));
        settings.registerSetting(new Setting("currency.only-active-all", "true", SettingType.BOOLEAN));

        setInterval(this.tickHandler, 5 * 60 * 1000);
    }

    tickHandler = async (): Promise<void[]> => {
        const ops = [];
        for (const channel of this.channelManager.getAll()) {
            if (this.isDisabled(channel)) continue;
            const amount = channel.online.get() ?
                await channel.getSetting<number>("currency.gain.online") :
                await channel.getSetting<number>("currency.gain.offline");

            for (const chatter of channel.getChatters()) {
                let balance = chatter.balance;
                if (typeof balance === undefined) balance = 0;
                ops.push(chatter.deposit(amount));
            }
        }
        return Promise.all(ops);
    };
}