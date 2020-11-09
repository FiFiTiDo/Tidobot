import AbstractModule, {Symbols} from "./AbstractModule";
import Permission from "../Systems/Permissions/Permission";
import {Role} from "../Systems/Permissions/Role";
import Setting, {Integer, SettingType} from "../Systems/Settings/Setting";
import Command from "../Systems/Commands/Command";
import {CommandEvent} from "../Systems/Commands/CommandEvent";
import {StringArg} from "../Systems/Commands/Validation/String";
import {FloatArg} from "../Systems/Commands/Validation/Float";
import {getLogger} from "../Utilities/Logger";
import {Argument, ChannelArg, ResponseArg, RestArguments, Sender} from "../Systems/Commands/Validation/Argument";
import {Response} from "../Chat/Response";
import CheckPermission from "../Systems/Commands/Validation/CheckPermission";
import {CommandHandler} from "../Systems/Commands/Validation/CommandHandler";
import {BetService, PlaceBetResponse} from "../Services/BetService";
import { Chatter } from "../Database/Entities/Chatter";
import { Channel } from "../Database/Entities/Channel";
import { Service } from "typedi";
import { CurrencySystem } from "../Systems/Currency/CurrencySystem";

export const MODULE_INFO = {
    name: "Betting",
    version: "1.2.0",
    description: "Place bets using points on a specific options, the total points is divided among those who bet for the winning option."
};

const logger = getLogger(MODULE_INFO.name);


@Service()
class BetCommand extends Command {
    constructor(
        private readonly betService: BetService,
        private readonly currencySystem: CurrencySystem
    ) {
        super("bet", "<place|open|close|check>");
    }

    @CommandHandler("bet place", "bet place <option> <amount>")
    @CheckPermission(() => BettingModule.permissions.placeBet)
    async place(
        event: CommandEvent, @ResponseArg response: Response, @Sender sender: Chatter, @ChannelArg channel: Channel,
        @Argument(StringArg) option: string,
        @Argument(new FloatArg({min: 1})) amount: number
    ): Promise<void> {
        try {
            const resp = await this.betService.placeBet(sender, option, amount);
            if (resp === null) return;
            switch (resp) {
                case PlaceBetResponse.INVALID_OPTION:
                    return await response.message("bet:error.invalid-option");
                case PlaceBetResponse.LOW_BALANCE:
                    return await response.message("currency:error.low-balance", {
                        currency_name: this.currencySystem.getPluralName(channel)
                    });
                case PlaceBetResponse.TOO_LOW:
                    return await response.message("bet:error.too-low");
                case PlaceBetResponse.TOO_HIGH:
                    return await response.message("bet:error.too-high");
                case PlaceBetResponse.BET_PLACED:
                    return await response.message("bet:placed", {
                        amount: this.currencySystem.formatAmount(amount, channel), option
                    });
            }
        } catch (e) {
            await response.genericErrorAndLog(e, logger);
        }
    }

    @CommandHandler("bet open", "bet open \"<title>\" <option 1> <option 2> ... <option n>")
    @CheckPermission(() => BettingModule.permissions.openBet)
    async open(
        event: CommandEvent, @ResponseArg response: Response, @ChannelArg channel: Channel,
        @Argument(StringArg) title: string,
        @RestArguments() options: string[]
    ): Promise<void> {
        if (this.betService.openBet(title, options, channel)) {
            return response.message("bet:opened", {title, options: options.join(", ")});
        } else {
            return response.message("bet:error.already-open");
        }
    }

    @CommandHandler("bet close", "bet close <winning option>")
    @CheckPermission(() => BettingModule.permissions.closeBet)
    async close(
        event: CommandEvent, @ResponseArg response: Response, @ChannelArg channel: Channel,
        @Argument(StringArg, "winning option") option: string
    ): Promise<void> {
        const game = this.betService.getGame(channel);
        if (!game?.isOpen()) return response.message("bet:error.not-open");
        const winnings = await game?.close(option);
        if (winnings === null) return response.message("bet:error.invalid-option", {option});
        else return response.message("bet:closed", {
            title: game.getTitle(), option, winnings: this.currencySystem.formatAmount(winnings, channel)
        });
    }

    @CommandHandler("bet check", "bet check")
    @CheckPermission(() => BettingModule.permissions.checkBet)
    async check(
        event: CommandEvent, @ResponseArg response: Response, @ChannelArg channel: Channel
    ): Promise<void> {
        const parts = [];
        const totals = await this.betService.getTotals(channel);
        if (totals === null) return response.message("bet:error.no-recent");
        const {grandTotal, optionTotals} = totals;
        for (const [option, total] of optionTotals)
            parts.push(await response.translate("bet:check.part", {
                option,
                amount: this.currencySystem.formatAmount(total, channel),
                percentage: (total / grandTotal) * 100
            }));
        await response.message("bet:check.full", {options: parts.join("; ")});
    }
}

@Service()
export default class BettingModule extends AbstractModule {
    static [Symbols.ModuleInfo] = MODULE_INFO;
    static settings = {
        minimumBet: new Setting("bet.minimum", 1 as Integer, SettingType.INTEGER),
        maximumBet: new Setting("bet.maximum", -1 as Integer, SettingType.INTEGER)
    }
    static permissions = {
        placeBet: new Permission("bet.place", Role.NORMAL),
        openBet: new Permission("bet.open", Role.MODERATOR),
        closeBet: new Permission("bet.close", Role.MODERATOR),
        checkBet: new Permission("bet.check", Role.MODERATOR),
    }

    constructor(betCommand: BetCommand) {
        super(BettingModule);

        this.registerCommand(betCommand);
        this.registerSettings(BettingModule.settings);
        this.registerPermissions(BettingModule.permissions);
    }
}