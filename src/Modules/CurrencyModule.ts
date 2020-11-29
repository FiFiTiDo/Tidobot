import AbstractModule, {Symbols} from "./AbstractModule";
import ConfirmationModule, {ConfirmedEvent} from "./ConfirmationModule";
import {Role} from "../Systems/Permissions/Role";
import Permission from "../Systems/Permissions/Permission";
import Setting, {Float, SettingType} from "../Systems/Settings/Setting";
import ChannelManager from "../Chat/ChannelManager";
import Command from "../Systems/Commands/Command";
import {FloatArg} from "../Systems/Commands/Validation/Float";
import {ChatterArg} from "../Systems/Commands/Validation/Chatter";
import {getLogger} from "../Utilities/Logger";
import {BooleanArg} from "../Systems/Commands/Validation/Boolean";
import ConnectedEvent from "../Chat/Events/ConnectedEvent";
import {EventHandler, HandlesEvents} from "../Systems/Event/decorators";
import DisconnectedEvent from "../Chat/Events/DisconnectedEvent";
import {CommandHandler} from "../Systems/Commands/Validation/CommandHandler";
import CheckPermission from "../Systems/Commands/Validation/CheckPermission";
import {Argument, ChannelArg, MessageArg, ResponseArg, Sender} from "../Systems/Commands/Validation/Argument";
import {Response} from "../Chat/Response";
import Message from "../Chat/Message";
import Timeout = NodeJS.Timeout;
import { Inject, Service } from "typedi";
import { Channel } from "../Database/Entities/Channel";
import { Chatter } from "../Database/Entities/Chatter";
import { ChatterManager } from "../Chat/ChatterManager";
import { TimeUnit } from "../Systems/Timer/TimerSystem";
import { CurrencyType } from "../Systems/Currency/CurrencyType";
import Event from "../Systems/Event/Event";
import { CurrencySystem } from "../Systems/Currency/CurrencySystem";

export const MODULE_INFO = {
    name: "Currency",
    version: "1.2.1",
    description: "A points system used for granting the use of certain bot features"
};

const logger = getLogger(MODULE_INFO.name);

@Service()
class BankCommand extends Command {
    constructor(
        private readonly currencySystem: CurrencySystem,
        private readonly chatterManager: ChatterManager,
        private readonly confirmationModule: ConfirmationModule
    ) {
        super("bank", "<give|give-all|take|take-all|balance|reset|reset-all>");
    }

    @CommandHandler("bank give", "bank give <user> <amount>", 1)
    @CheckPermission(() => CurrencyModule.permissions.bankGive)
    async give(
        event: Event, @ResponseArg response: Response, @ChannelArg channel: Channel,
        @Argument(new ChatterArg()) chatter: Chatter, @Argument(new FloatArg({min: 1})) amount: number
    ): Promise<void> {
        return chatter.deposit(amount)
            .then(async () => response.message("currency:give", {
                amount: CurrencyType.get(channel).formatAmount(amount),
                username: chatter.user.name
            })).catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler("bank give-all", "bank give-all <amount>", 1)
    @CheckPermission(() => CurrencyModule.permissions.bankGiveAll)
    async giveAll(
        event: Event, @ResponseArg response: Response, @ChannelArg channel: Channel,
        @Argument(new FloatArg({min: 1})) amount: number,
        @Argument(BooleanArg, "only-active", false) onlyActive: boolean
    ): Promise<void> {
        return this.currencySystem.giveAll(channel, amount, onlyActive)
            .then(async () => response.message("currency:give-all", {
                amount: CurrencyType.get(channel).formatAmount(amount),
            })).catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler("bank take", "bank take <user> <amount>", 1)
    @CheckPermission(() => CurrencyModule.permissions.bankTake)
    async take(
        event: Event, @ResponseArg response: Response, @ChannelArg channel: Channel,
        @Argument(new ChatterArg()) chatter: Chatter,
        @Argument(new FloatArg({min: 1})) amount: number
    ): Promise<void> {
        return chatter.withdraw(amount)
            .then(async () => response.message("currency:take", {
                amount: CurrencyType.get(channel).formatAmount(amount),
                username: chatter.user.name
            })).catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler("bank take", "bank take-all <amount>", 1)
    @CheckPermission(() => CurrencyModule.permissions.bankTakeAll)
    async takeAll(
        event: Event, @ResponseArg response: Response, @ChannelArg channel: Channel,
        @Argument(new FloatArg({min: 1})) amount: number,
        @Argument(BooleanArg, "only-active", false) onlyActive: boolean
    ): Promise<void> {
        return this.currencySystem.takeAll(channel, amount, onlyActive)
            .then(async () => response.message("currency:take-all", {
                amount: CurrencyType.get(channel).formatAmount(amount),
            })).catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^bank (balance|bal)/, "bank balance <username>", 1)
    @CheckPermission(() => CurrencyModule.permissions.bankBalance)
    async balance(
        event: Event, @ResponseArg response: Response, @ChannelArg channel: Channel,
        @Argument(new ChatterArg()) chatter: Chatter
    ): Promise<void> {
        return response.message("currency:balance-other", {
            username: chatter.user.name,
            balance: CurrencyType.get(channel).formatAmount(chatter.balance)
        });
    }

    @CommandHandler("bank reset", "bank reset <username>", 1)
    @CheckPermission(() => CurrencyModule.permissions.bankReset)
    async reset(
        event: Event, @ResponseArg response: Response, @Argument(new ChatterArg()) chatter: Chatter
    ): Promise<void> {
        chatter.balance = 0;
        return chatter.save()
            .then(() => response.message("currency:reset.user", {username: chatter.user.name}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler("bank reset-all", "bank reset", 1)
    @CheckPermission(() => CurrencyModule.permissions.bankResetAll)
    async resetAll(
        event: Event, @ResponseArg response: Response, @ChannelArg channel: Channel, @MessageArg msg: Message
    ): Promise<void> {
        const confirmation = await this.confirmationModule.make(msg, await response.translate("currency.reset.all-confirm"), 30);
        confirmation.addListener(ConfirmedEvent, () => this.currencySystem.resetChannel(channel)
            .then(() => response.message("currency:reset.all"))
            .catch(e => response.genericErrorAndLog(e, logger))
        );
        confirmation.run();
    }
}

@Service()
class BalanceCommand extends Command {
    constructor() {
        super("balance", null, ["bal"]);
    }

    @CommandHandler(/^(balance|bal)/, "balance")
    @CheckPermission(() => CurrencyModule.permissions.getBalance)
    async handleCommand(
        event: Event, @ResponseArg response: Response, @ChannelArg channel: Channel, @Sender sender: Chatter
    ): Promise<void> {
        return response.message("currency:balance", {
            username: sender.user.name,
            balance: CurrencyType.get(channel).formatAmount(sender.balance)
        });
    }
}

@Service()
class PayCommand extends Command {
    constructor() {
        super("pay", "<user> <amount>");
    }

    @CommandHandler("pay", "pay <user> <amount>")
    @CheckPermission(() => CurrencyModule.permissions.payUser)
    async handleCommand(
        event: Event, @ResponseArg response: Response, @Sender sender: Chatter, @ChannelArg channel: Channel,
        @Argument(new ChatterArg()) chatter: Chatter,
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
                    username: chatter.user.name,
                    amount: CurrencyType.get(channel).formatAmount(amount)
                })).catch(e => response.genericErrorAndLog(e, logger));
        }
    }
}

@HandlesEvents()
@Service()
export default class CurrencyModule extends AbstractModule {
    static [Symbols.ModuleInfo] = MODULE_INFO;
    static permissions = {
        payUser: new Permission("currency.pay", Role.NORMAL),
        getBalance: new Permission("currency.balance", Role.NORMAL),
        bankGive: new Permission("currency.bank.give", Role.MODERATOR),
        bankGiveAll: new Permission("currency.bank.give-all", Role.MODERATOR),
        bankTake: new Permission("currency.bank.take", Role.MODERATOR),
        bankTakeAll: new Permission("currency.bank.take-all", Role.MODERATOR),
        bankBalance: new Permission("currency.bank.balance", Role.MODERATOR),
        bankReset: new Permission("currency.bank.reset", Role.MODERATOR),
        bankResetAll: new Permission("currency.bank.reset-all", Role.BROADCASTER)
    }
    static settings = {
        singularCurrencyName: new Setting("currency.name.singular", "point", SettingType.STRING),
        pluralCurrencyName: new Setting("currency.name.plural", "points", SettingType.STRING),
        onlineGain: new Setting("currency.gain.online", 10 as Float, SettingType.FLOAT),
        offlineGain: new Setting("currency.gain.offline", 2 as Float, SettingType.FLOAT)
    }
    tickInterval: Timeout;

    constructor(
        private readonly currencySystem: CurrencySystem,
        private readonly channelManager: ChannelManager,
        @Inject(() => BankCommand) bankCommand: BankCommand,
        @Inject(() => BalanceCommand) balanceCommand: BalanceCommand,
        @Inject(() => PayCommand) payCommand: PayCommand
    ) {
        super(CurrencyModule);

        this.registerCommand(bankCommand);
        this.registerCommand(balanceCommand);
        this.registerCommand(payCommand);
    }

    @EventHandler(ConnectedEvent)
    handleConnected(): void {
        this.tickInterval = setInterval(this.tickHandler.bind(this), TimeUnit.Minutes(5));
    }

    @EventHandler(DisconnectedEvent)
    handleDisconnected(): void {
        clearInterval(this.tickInterval);
    }

    async tickHandler(): Promise<void> {
        await this.channelManager.getAllActive()
            .then(channels => channels
                .filter(channel => !this.isDisabled(channel))
                .map(async channel => {
                    const amount = channel.settings.get(
                        this.channelManager.isOnline(channel) ? 
                            CurrencyModule.settings.onlineGain : 
                            CurrencyModule.settings.offlineGain
                    );
                    return this.currencySystem.giveAll(channel, amount, true);
                })
            ).then(promises => Promise.all(promises));
    }
}