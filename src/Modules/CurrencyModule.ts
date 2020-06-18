import AbstractModule, {Symbols, Systems} from "./AbstractModule";
import {pluralize} from "../Utilities/functions";
import * as util from "util";
import {ConfirmationFactory, ConfirmedEvent} from "./ConfirmationModule";
import ChannelEntity from "../Database/Entities/ChannelEntity";
import ChatterEntity from "../Database/Entities/ChatterEntity";
import {Role} from "../Systems/Permissions/Role";
import Permission from "../Systems/Permissions/Permission";
import Setting, {Float, SettingType} from "../Systems/Settings/Setting";
import {inject} from "inversify";
import symbols from "../symbols";
import ChannelManager from "../Chat/ChannelManager";
import Command from "../Systems/Commands/Command";
import {CommandEventArgs} from "../Systems/Commands/CommandEvent";
import {float} from "../Systems/Commands/Validator/Float";
import {chatter as chatterConverter} from "../Systems/Commands/Validator/Chatter";
import StandardValidationStrategy from "../Systems/Commands/Validator/Strategies/StandardValidationStrategy";
import {ValidatorStatus} from "../Systems/Commands/Validator/Strategies/ValidationStrategy";
import {tuple} from "../Utilities/ArrayUtils";
import {getLogger} from "../Utilities/Logger";
import {permission} from "../Systems/Permissions/decorators";
import {setting} from "../Systems/Settings/decorators";
import {boolean} from "../Systems/Commands/Validator/Boolean";
import {command, Subcommand} from "../Systems/Commands/decorators";
import ConnectedEvent from "../Chat/Events/ConnectedEvent";
import {EventHandler} from "../Systems/Event/decorators";
import Timeout = NodeJS.Timeout;
import DisconnectedEvent from "../Chat/Events/DisconnectedEvent";

export const MODULE_INFO = {
    name: "Currency",
    version: "1.0.1",
    description: "A points system used for granting the use of certain bot features"
};

const logger = getLogger(MODULE_INFO.name);

class BankCommand extends Command {
    constructor(private currencyModule: CurrencyModule, private confirmationFactory: ConfirmationFactory) {
        super("bank", "<give|give-all|take|take-all|balance|reset|reset-all>");
    }

    @Subcommand("give")
    async give({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "bank give <user> <amount>",
            subcommand: "give",
            arguments: tuple(
                chatterConverter({ name: "user", required: true }),
                float({ name: "amount", required: true })
            ),
            permission: this.currencyModule.bankGive
        }));
        if (status !== ValidatorStatus.OK) return;
        const [chatter, amount] = args;

        try {
            await chatter.deposit(amount);
            await response.message("currency:give", {
                amount: await CurrencyModule.formatAmount(amount, msg.getChannel()),
                username: chatter.name
            });
        } catch (e) {
            await response.genericError();
            logger.error("Failed to give money to chatter's bank account");
            logger.error("Caused by: " + e.message);
            logger.error(e.stack);
        }
    }

    @Subcommand("give-all")
    async giveAll({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "bank give-all <amount>",
            subcommand: "give-all",
            arguments: tuple(
                float({ name: "amount", required: true }),
                boolean({ name: "only-active", required: false, defaultValue: true })
            ),
            permission: this.currencyModule.bankGiveAll
        }));
        if (status !== ValidatorStatus.OK) return;
        const [amount, onlyActive] = args;

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
            logger.error("Failed to give amount to all chatter's accounts");
            logger.error("Caused by: " + e.message);
            logger.error(e.stack);
        }
    }

    @Subcommand("take")
    async take({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "bank take <user> <amount>",
            subcommand: "take",
            arguments: tuple(
                chatterConverter({ name: "user", required: true }),
                float({ name: "amount", required: true })
            ),
            permission: this.currencyModule.bankTake
        }));
         if (status !== ValidatorStatus.OK) return;
        const [chatter, amount] = args;

        try {
            await chatter.withdraw(amount);
            await response.message("currency:take", {
                amount: await CurrencyModule.formatAmount(amount, msg.getChannel()),
                username: chatter.name
            });
        } catch (e) {
            await response.genericError();
            logger.error("Failed to take money from chatter's bank account");
            logger.error("Caused by: " + e.message);
            logger.error(e.stack);
        }
    }

    @Subcommand("take-all")
    async takeAll({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "bank take-all <amount>",
            subcommand: "take-all",
            arguments: tuple(
                float({ name: "amount", required: true }),
                boolean({ name: "only-active", required: false, defaultValue: true })
            ),
            permission: this.currencyModule.bankTakeAll
        }));
         if (status !== ValidatorStatus.OK) return;
        const [amount, onlyActive] = args;
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
            logger.error("Failed to take amount out of all chatter's accounts");
            logger.error("Caused by: " + e.message);
            logger.error(e.stack);
        }
    }

    @Subcommand("balance", "bal")
    async balance({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "bank balance <user>",
            subcommand: "balance",
            arguments: tuple(
                chatterConverter({ name: "user", required: true })
            ),
            permission: this.currencyModule.bankBalance
        }));
         if (status !== ValidatorStatus.OK) return;
        const [chatter] = args;

        await response.message("currency:balance-other", {
            username: chatter.name,
            balance: await CurrencyModule.formatAmount(chatter.balance, msg.getChannel())
        });
    }

    @Subcommand("reset")
    async reset({event, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "bank reset <user>",
            subcommand: "reset",
            arguments: tuple(
                chatterConverter({ name: "user", required: true })
            ),
            permission: this.currencyModule.bankReset
        }));
         if (status !== ValidatorStatus.OK) return;
        const [chatter] = args;

        try {
            chatter.balance = 0;
            await chatter.save();
            await response.message("currency:reset.user", {
                username: chatter.name
            });
        } catch (e) {
            await response.genericError();
            logger.error("Failed to reset chatter's bank account");
            logger.error("Caused by: " + e.message);
            logger.error(e.stack);
        }
    }

    @Subcommand("reset-all")
    async resetAll({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {status} = await event.validate(new StandardValidationStrategy({
            usage: "bank reset-all",
            subcommand: "reset-all",
            permission: this.currencyModule.bankResetAll
        }));
         if (status !== ValidatorStatus.OK) return;

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
                logger.error("Unable to reset currency module");
            logger.error("Caused by: " + e.message);
            logger.error(e.stack);
            }
        });
        confirmation.run();
    }
}

class BalanceCommand extends Command {
    constructor(private currencyModule: CurrencyModule) {
        super("balance", null, ["bal"]);
    }

    async execute({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {status} = await event.validate(new StandardValidationStrategy({
            usage: "balance",
            permission: this.currencyModule.getBalance
        }));
         if (status !== ValidatorStatus.OK) return;

        const balance = msg.getChatter().balance;
        await response.message("currency:balance", {
            username: msg.getChatter().name,
            balance: await CurrencyModule.formatAmount(balance, msg.getChannel())
        });
    }
}

class PayCommand extends Command {
    constructor(private currencyModule: CurrencyModule) {
        super("pay", "<user> <amount>");
    }

    async execute({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "pay <user> <amount>",
            arguments: tuple(
                chatterConverter({ name: "user", required: true }),
                float({ name: "amount", required: true })
            ),
            permission: this.currencyModule.payUser
        }));
         if (status !== ValidatorStatus.OK) return;
        const [chatter, amount] = args;

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
    static [Symbols.ModuleInfo] = MODULE_INFO;

    constructor(
        @inject(symbols.ConfirmationFactory) private makeConfirmation: ConfirmationFactory,
        @inject(ChannelManager) private channelManager: ChannelManager
    ) {
        super(CurrencyModule);
    }

    static async getSingularName(channel: ChannelEntity): Promise<string> {
        return channel.getSetting<SettingType.STRING>("currency.name.singular");
    }

    static async getPluralName(channel: ChannelEntity): Promise<string> {
        return channel.getSetting<SettingType.STRING>("currency.name.plural");
    }

    static async formatAmount(amount: number, channel: ChannelEntity): Promise<string> {
        const singular = await this.getSingularName(channel);
        const plural = await this.getPluralName(channel);

        return util.format("%d %s", amount, pluralize(amount, singular, plural));
    }

    @command bankCommand = new BankCommand(this, this.makeConfirmation);
    @command balanceCommand = new BalanceCommand(this);
    @command payCommand = new PayCommand(this);

    @permission payUser = new Permission("currency.pay", Role.NORMAL);
    @permission getBalance = new Permission("currency.balance", Role.NORMAL);
    @permission bankGive = new Permission("currency.bank.give", Role.MODERATOR);
    @permission bankGiveAll = new Permission("currency.bank.give-all", Role.MODERATOR);
    @permission bankTake = new Permission("currency.bank.take", Role.MODERATOR);
    @permission bankTakeAll = new Permission("currency.bank.take-all", Role.MODERATOR);
    @permission bankBalance = new Permission("currency.bank.balance", Role.MODERATOR);
    @permission bankReset = new Permission("currency.bank.reset", Role.MODERATOR);
    @permission bankResetAll = new Permission("currency.bank.reset-all", Role.BROADCASTER);

    @setting singularCurrencyName = new Setting("currency.name.singular", "point", SettingType.STRING);
    @setting pluralCurrencyName = new Setting("currency.name.plural", "points", SettingType.STRING);
    @setting onlineGain = new Setting("currency.gain.online", 10 as Float, SettingType.FLOAT);
    @setting offlineGain = new Setting("currency.gain.offline", 2 as Float, SettingType.FLOAT);

    tickInterval: Timeout;

    @EventHandler(ConnectedEvent)
    handleConnected() {
        this.tickInterval = setInterval(this.tickHandler.bind(this), 5 * 60 * 1000);
    }

    @EventHandler(DisconnectedEvent)
    handleDisconnected() {
        clearInterval(this.tickInterval);
    }

    async tickHandler(): Promise<void[]> {
        const ops = [];
        for (const channel of this.channelManager.getAll()) {
            if (this.isDisabled(channel)) continue;
            const amount = channel.online.get() ?
                await channel.getSetting(this.onlineGain) :
                await channel.getSetting(this.offlineGain);

            for (const chatter of channel.getChatters()) {
                let balance = chatter.balance;
                if (typeof balance === undefined) balance = 0;
                ops.push(chatter.deposit(amount));
            }
        }
        return Promise.all(ops);
    }
}