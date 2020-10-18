import AbstractModule, {Symbols} from "./AbstractModule";
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
import {CommandEvent} from "../Systems/Commands/CommandEvent";
import {FloatArg} from "../Systems/Commands/Validation/Float";
import {ChatterArg} from "../Systems/Commands/Validation/Chatter";
import {getLogger} from "../Utilities/Logger";
import {permission} from "../Systems/Permissions/decorators";
import {setting} from "../Systems/Settings/decorators";
import {BooleanArg} from "../Systems/Commands/Validation/Boolean";
import {command} from "../Systems/Commands/decorators";
import ConnectedEvent from "../Chat/Events/ConnectedEvent";
import {EventHandler} from "../Systems/Event/decorators";
import DisconnectedEvent from "../Chat/Events/DisconnectedEvent";
import {CommandHandler} from "../Systems/Commands/Validation/CommandHandler";
import CheckPermission from "../Systems/Commands/Validation/CheckPermission";
import {Argument, ChannelArg, MessageArg, ResponseArg, Sender} from "../Systems/Commands/Validation/Argument";
import {Response} from "../Chat/Response";
import Message from "../Chat/Message";
import Timeout = NodeJS.Timeout;

export const MODULE_INFO = {
    name: "Currency",
    version: "1.1.1",
    description: "A points system used for granting the use of certain bot features"
};

const logger = getLogger(MODULE_INFO.name);

class BankCommand extends Command {
    constructor(private confirmationFactory: ConfirmationFactory) {
        super("bank", "<give|give-all|take|take-all|balance|reset|reset-all>");
    }

    @CommandHandler("bank give", "bank give <user> <amount>", 1)
    @CheckPermission("currency.bank.give")
    async give(
        event: CommandEvent, @ResponseArg response: Response, @ChannelArg channel: ChannelEntity,
        @Argument(new ChatterArg()) chatter: ChatterEntity, @Argument(new FloatArg({min: 1})) amount: number
    ): Promise<void> {
        return chatter.deposit(amount)
            .then(async () => response.message("currency:give", {
                amount: await CurrencyModule.formatAmount(amount, channel),
                username: chatter.name
            })).catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler("bank give-all", "bank give-all <amount>", 1)
    @CheckPermission("currency.bank.give-all")
    async giveAll(
        event: CommandEvent, @ResponseArg response: Response, @ChannelArg channel: ChannelEntity,
        @Argument(new FloatArg({min: 1})) amount: number,
        @Argument(BooleanArg, "only-active", false) onlyActive: boolean
    ): Promise<void> {
        const chatters: ChatterEntity[] = onlyActive ? channel.getChatters() : await ChatterEntity.getAll({channel});
        return Promise.all(chatters.map(chatter => chatter.deposit(amount)))
            .then(async () => response.message("currency:give-all", {
                amount: await CurrencyModule.formatAmount(amount, channel)
            })).catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler("bank take", "bank take <user> <amount>", 1)
    @CheckPermission("currency.bank.take")
    async take(
        event: CommandEvent, @ResponseArg response: Response, @ChannelArg channel: ChannelEntity,
        @Argument(new ChatterArg()) chatter: ChatterEntity,
        @Argument(new FloatArg({min: 1})) amount: number
    ): Promise<void> {
        return chatter.withdraw(amount)
            .then(async () => response.message("currency:take", {
                amount: await CurrencyModule.formatAmount(amount, channel),
                username: chatter.name
            })).catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler("bank take", "bank take-all <amount>", 1)
    @CheckPermission("currency.bank.take-all")
    async takeAll(
        event: CommandEvent, @ResponseArg response: Response, @ChannelArg channel: ChannelEntity,
        @Argument(new FloatArg({min: 1})) amount: number,
        @Argument(BooleanArg, "only-active", false) onlyActive: boolean
    ): Promise<void> {
        const chatters: ChatterEntity[] = onlyActive ? channel.getChatters() : await ChatterEntity.getAll({channel});
        return Promise.all(chatters.map(chatter => chatter.withdraw(amount)))
            .then(async () => response.message("currency:take-all", {
                amount: await CurrencyModule.formatAmount(amount, channel)
            })).catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^bank (balance|bal)/, "bank balance <username>", 1)
    @CheckPermission("currency.bank.balance")
    async balance(
        event: CommandEvent, @ResponseArg response: Response, @ChannelArg channel: ChannelEntity,
        @Argument(new ChatterArg()) chatter: ChatterEntity
    ): Promise<void> {
        return response.message("currency:balance-other", {
            username: chatter.name,
            balance: await chatter.getFormattedBalance()
        });
    }

    @CommandHandler("bank reset", "bank reset <username>", 1)
    @CheckPermission("currency.bank.reset")
    async reset(
        event: CommandEvent, @ResponseArg response: Response, @ChannelArg channel: ChannelEntity,
        @Argument(new ChatterArg()) chatter: ChatterEntity
    ): Promise<void> {
        chatter.balance = 0;
        return chatter.save()
            .then(() => response.message("currency:reset.user", {username: chatter.name}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler("bank reset-all", "bank reset", 1)
    @CheckPermission("currency.bank.reset-all")
    async resetAll(
        event: CommandEvent, @ResponseArg response: Response, @ChannelArg channel: ChannelEntity, @MessageArg msg: Message
    ): Promise<void> {
        const confirmation = await this.confirmationFactory(msg, await response.translate("currency.reset.all-confirm"), 30);
        confirmation.addListener(ConfirmedEvent, () => ChatterEntity.getAll({channel})
            .then(chatters => Promise.all(chatters.map(chatter => {
                chatter.balance = 0;
                return chatter.save();
            })))
            .then(() => response.message("currency:reset.all"))
            .catch(e => response.genericErrorAndLog(e, logger))
        );
        confirmation.run();
    }
}

class BalanceCommand extends Command {
    constructor() {
        super("balance", null, ["bal"]);
    }

    @CommandHandler(/^(balance|bal)/, "balance")
    @CheckPermission("currency.balance")
    async handleCommand(
        event: CommandEvent, @ResponseArg response: Response, @Sender sender: ChatterEntity, @ChannelArg channel: ChannelEntity
    ): Promise<void> {
        return response.message("currency:balance", {
            username: sender.name,
            balance: await sender.getFormattedBalance()
        });
    }
}

class PayCommand extends Command {
    constructor() {
        super("pay", "<user> <amount>");
    }

    @CommandHandler("pay", "pay <user> <amount>")
    @CheckPermission("currency.pay")
    async handleCommand(
        event: CommandEvent, @ResponseArg response: Response, @Sender sender: ChatterEntity, @ChannelArg channel: ChannelEntity,
        @Argument(new ChatterArg()) chatter: ChatterEntity,
        @Argument(new FloatArg({min: 1})) amount: number
    ): Promise<void> {
        const successful = await sender.charge(amount);
        if (successful === false) {
            return response.message("currency:error.low-balance");
        } else if (successful === null) {
            return response.genericError();
        } else {
            return chatter.deposit(amount)
                .then(async () => response.message("currency.pay", {
                    username: chatter.name,
                    amount: await CurrencyModule.formatAmount(amount, channel)
                })).catch(e => response.genericErrorAndLog(e, logger));
        }
    }
}

export default class CurrencyModule extends AbstractModule {
    static [Symbols.ModuleInfo] = MODULE_INFO;
    @command bankCommand = new BankCommand(this.makeConfirmation);
    @command balanceCommand = new BalanceCommand();
    @command payCommand = new PayCommand();
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

    @EventHandler(ConnectedEvent)
    handleConnected() {
        this.tickInterval = setInterval(this.tickHandler.bind(this), 5 * 60 * 1000);
    }

    @EventHandler(DisconnectedEvent)
    handleDisconnected() {
        clearInterval(this.tickInterval);
    }

    async tickHandler(): Promise<void[][]> {
        return Promise.all(
            this.channelManager.getAllActive()
                .filter(channel => !this.isDisabled(channel))
                .map(async channel => {
                    const amount = await channel.getSetting(channel.online.get() ? this.onlineGain : this.offlineGain);
                    return Promise.all(channel.getChatters().map(chatter => chatter.deposit(amount)));
                })
        );
    }
}