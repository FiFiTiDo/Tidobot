import AbstractModule from "./AbstractModule";
import CommandModule, {CommandEvent, SubcommandHelper} from "./CommandModule";
import SettingsModule from "./SettingsModule";
import PermissionModule, {PermissionLevel} from "./PermissionModule";
import Chatter from "../Chat/Chatter";
import Application from "../Application/Application";
import {__, pluralize} from "../Utilities/functions";
import Channel from "../Chat/Channel";
import * as util from "util";
import ConfirmationModule, {ConfirmedEvent} from "./ConfirmationModule";
import {StringToBooleanConverter, StringToFloatConverter, StringToStringConverter} from "../Utilities/Converter";

export default class CurrencyModule extends AbstractModule {
    constructor() {
        super(CurrencyModule.name);
    }

    initialize() {
        const cmd = this.getModuleManager().getModule(CommandModule);
        cmd.registerCommand("bank", this.bankCommand, this);
        cmd.registerCommand("balance", this.balanceCommand, this);
        cmd.registerCommand("bal", this.balanceCommand, this);
        cmd.registerCommand("pay", this.payCommand, this);

        const perm = this.getModuleManager().getModule(PermissionModule);
        perm.registerPermission("currency.pay", PermissionLevel.NORMAL);
        perm.registerPermission("currency.balance", PermissionLevel.NORMAL);
        perm.registerPermission("currency.bank.give", PermissionLevel.MODERATOR);
        perm.registerPermission("currency.bank.give-all", PermissionLevel.MODERATOR);
        perm.registerPermission("currency.bank.take", PermissionLevel.MODERATOR);
        perm.registerPermission("currency.bank.take-all", PermissionLevel.MODERATOR);
        perm.registerPermission("currency.bank.balance", PermissionLevel.MODERATOR);
        perm.registerPermission("currency.bank.reset", PermissionLevel.MODERATOR);
        perm.registerPermission("currency.bank.reset-all", PermissionLevel.BROADCASTER);

        const settings = this.getModuleManager().getModule(SettingsModule);
        settings.registerSetting("currency.name.singular", "point", StringToStringConverter.func);
        settings.registerSetting("currency.name.plural", "points", StringToStringConverter.func);
        settings.registerSetting("currency.gain.online", "10", StringToFloatConverter.func);
        settings.registerSetting("currency.gain.offline", "2", StringToFloatConverter.func);
        settings.registerSetting("currency.only-active-all", "true", StringToBooleanConverter.func);

        setInterval(this.tickHandler, 5 * 60 * 1000);
    }

    tickHandler = async () => {
        let ops = [];
        for (let channel of Application.getChannelManager().getAll()) {
            if (this.isDisabled(channel)) continue;
            let amount = channel.online.get() ?
                await channel.getSettings().get("currency.gain.online") :
                await channel.getSettings().get("currency.gain.offline");

            for (let chatter of Application.getChatterManager().getAll(channel)) {
                let balance = chatter.getBalance();
                if (typeof balance === "undefined") balance = 0;
                ops.push(chatter.deposit(amount));
            }
        }
        return Promise.all(ops);
    };

    async charge(chatter: Chatter, amount: number): Promise<boolean|null> {
        if (chatter.getBalance() < amount) return false;

        try {
            await chatter.withdraw(amount);
        } catch(e) {
            Application.getLogger().error("Failed to charge user", { cause: e });
            return null;
        }

        return true;
    }

    async getPluralName(channel: Channel) {
        return channel.getSettings().get("currency.name.plural");
    }

    async getSingularName(channel: Channel) {
        return channel.getSettings().get("currency.name.singular");
    }

    async formatAmount(amount: number, channel: Channel) {
        let singular = await this.getSingularName(channel);
        let plural = await this.getPluralName(channel);

        return util.format("%d %s", amount, pluralize(amount, singular, plural));
    }

    bankCommand(event: CommandEvent) {
        new SubcommandHelper.Builder()
            .addSubcommand("give", this.give)
            .addSubcommand("give-all", this.giveAll)
            .addSubcommand("take", this.take)
            .addSubcommand("take-all", this.takeAll)
            .addSubcommand("balance", this.balance)
            .addSubcommand("bal", this.balance)
            .addSubcommand("reset", this.reset)
            .addSubcommand("reset-all", this.resetAll)
            .build(this)
            .handle(event);
    }

    async give(event: CommandEvent) {
        const msg = event.getMessage();
        const args = await event.validate({
            usage: "bank give <user> <amount>",
            arguments: [
                {
                    type: "string",
                    required: true
                },
                {
                    type: "string",
                    required: true
                },
                {
                    type: "float",
                    required: true
                }
            ],
            permission: "currency.bank.give"
        });
        if (args === null) return;

        let chatter = Application.getChatterManager().findByName(args[1], msg.getChannel());
        if (chatter === null)
            return msg.reply(__("general.user.unknown", args[1]));


        try {
            await chatter.deposit(args[2]);
            await msg.reply(__("currency.give.successful", await this.formatAmount(args[2], msg.getChannel()), chatter.getName()));
        } catch(e) {
            await msg.reply(__("currency.give.failed"));
            Application.getLogger().error("Failed to give money to chatter's bank account", { cause: e });
        }
    };

    async giveAll(event: CommandEvent) {
        const msg = event.getMessage();
        const args = await event.validate({
            usage: "bank give-all <amount>",
            arguments: [
                {
                    type: "string",
                    required: true
                },
                {
                    type: "float",
                    required: true
                }
            ],
            permission: "currency.bank.give-all"
        });
        if (args === null) return;
        let [, amount] = args;

        let only_active = msg.getChannel().getSettings().get("currency.only-active-all");
        let chatters = only_active ? Application.getChatterManager().getAll(msg.getChannel()) : await Chatter.getAll(msg.getChannel());

        let ops = [];
        for (let chatter of chatters)
            ops.push(chatter.deposit(amount));

        try {
            await Promise.all(ops);
            await msg.reply(__("currency.give-all.successful", await this.formatAmount(amount, msg.getChannel())));
        } catch (e) {
            Application.getLogger().error("Failed to give amount to all chatter's accounts", { cause: e });
            await msg.reply(__("currency.give-all.failed"));
        }
    };

    async take(event: CommandEvent) {
        const msg = event.getMessage();
        const args = await event.validate({
            usage: "bank take <user> <amount>",
            arguments: [
                {
                    type: "string",
                    required: true
                },
                {
                    type: "string",
                    required: true
                },
                {
                    type: "float",
                    required: true
                }
            ],
            permission: "currency.bank.take"
        });
        if (args === null) return;

        let chatter = Application.getChatterManager().findByName(args[1], msg.getChannel());
        if (chatter === null)
            return msg.reply(__("general.user.unknown", args[1]));

        try {
            await chatter.withdraw(args[2]);
            await msg.reply(__("currency.take.successful", await this.formatAmount(args[2], msg.getChannel()), chatter.getName()));
        } catch(e) {
            await msg.reply(__("currency.take.failed"));
            Application.getLogger().error("Failed to take money from chatter's bank account", { cause: e });
        }
    };

    async takeAll(event: CommandEvent) {
        const msg = event.getMessage();
        const args = await event.validate({
            usage: "bank take-all <amount>",
            arguments: [
                {
                    type: "string",
                    required: true
                },
                {
                    type: "float",
                    required: true
                }
            ],
            permission: "currency.bank.take-all"
        });
        if (args === null) return;
        let [, amount] = args;

        let only_active = msg.getChannel().getSettings().get("currency.only-active-all");
        let chatters = only_active ? Application.getChatterManager().getAll(msg.getChannel()) : await Chatter.getAll(msg.getChannel());

        let ops = [];
        for (let chatter of chatters)
            ops.push(chatter.withdraw(amount));

        try {
            await Promise.all(ops);
            await msg.reply(__("currency.take-all.successful", await this.formatAmount(amount, msg.getChannel())));
        } catch (e) {
            Application.getLogger().error("Failed to take amount out of all chatter's accounts", { cause: e });
            await msg.reply(__("currency.take-all.failed"));
        }
    };

    async balance(event: CommandEvent) {
        const msg = event.getMessage();
        const args = await event.validate({
            usage: "bank balance <user>",
            arguments: [
                {
                    type: "string",
                    required: true
                },
                {
                    type: "string",
                    required: true
                }
            ],
            permission: "currency.bank.balance"
        });
        if (args === null) return;

        let chatter = Application.getChatterManager().findByName(args[1], msg.getChannel());
        if (chatter === null)
            return msg.reply(__("general.user.unknown", args[1]));

        await msg.reply(__("currency.balance-other", chatter.getName(), await this.formatAmount(chatter.getBalance(), msg.getChannel())))
    };

    async reset(event: CommandEvent) {
        const msg = event.getMessage();
        const args = await event.validate({
            usage: "bank reset <user>",
            arguments: [
                {
                    type: "string",
                    required: true
                },
                {
                    type: "string",
                    required: true
                }
            ],
            permission: "currency.bank.reset"
        });
        if (args === null) return;

        let chatter = Application.getChatterManager().findByName(args[1], msg.getChannel());
        if (chatter === null)
            return msg.reply(__("general.user.unknown", args[1]));

        try {
            await chatter.setBalance(0);
            await msg.reply(__("currency.reset.successful", chatter.getName()));
        } catch(e) {
            await msg.reply(__("currency.reset.failed"));
            Application.getLogger().error("Failed to reset chatter's bank account", { cause: e });
        }
    };

    async resetAll(event: CommandEvent) {
        const msg = event.getMessage();
        const args = await event.validate({
            usage: "bank reset-all",
            permission: "currency.bank.reset-all"
        });
        if (args === null) return;

        let confirmation = await ConfirmationModule.make(msg, __("currency.reset-all.confirmation"), 30);
        confirmation.addListener(ConfirmedEvent, async () => {
           try {
               let chatters = await msg.getChannel().query("chatters").select().all();
               let ops = [];
               for (let chatter of chatters) {
                   chatter.balance = 0;
                   ops.push(msg.getChannel().query("chatters").update(chatter).exec());
               }
               await Promise.all(ops);
               await msg.reply(__("currency.reset-all.successful"));
           } catch (e) {
               await msg.reply(__("currency.reset-all.successful"));
               Application.getLogger().error("Unable to reset currency module", { cause: e });
           }
        });
        confirmation.run();
    };

    async balanceCommand(event: CommandEvent) {
        const msg = event.getMessage();
        const args = await event.validate({
            usage: "balance",
            permission: "currency.balance"
        });
        if (args === null) return;

        let balance = msg.getChatter().getBalance();
        await msg.reply(__("currency.balance", msg.getChatter().getName(), await this.formatAmount(balance, msg.getChannel())))
    }

    async payCommand(event: CommandEvent) {
        const msg = event.getMessage();
        const args = await event.validate({
            usage: "pay <user> <amount>",
            arguments: [
                {
                    type: "string",
                    required: true
                },
                {
                    type: "float",
                    required: true
                }
            ],
            permission: "currency.pay"
        });
        if (args === null) return;
        let [username, amount] = args;

        let chatter = Application.getChatterManager().findByName(username, msg.getChannel());
        if (chatter === null)
            return msg.reply(__("general.user.unknown", username));

        let successful = await this.charge(msg.getChatter(), amount);
        if (successful === false) {
            await msg.reply(__("currency.low-balance"));
        } else if (successful === null) {
            await msg.reply(__("currency.pay.successful", await this.formatAmount(amount, msg.getChannel()), username));
        } else {
            await msg.reply(__("currency.pay.failed"));
        }
    }
}