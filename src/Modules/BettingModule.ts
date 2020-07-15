import AbstractModule, {Symbols} from "./AbstractModule";
import CurrencyModule from "./CurrencyModule";
import ChatterEntity from "../Database/Entities/ChatterEntity";
import ChannelEntity from "../Database/Entities/ChannelEntity";
import Permission from "../Systems/Permissions/Permission";
import {Role} from "../Systems/Permissions/Role";
import Setting, {Integer, SettingType} from "../Systems/Settings/Setting";
import Command from "../Systems/Commands/Command";
import {CommandEvent} from "../Systems/Commands/CommandEvent";
import {StringConverter} from "../Systems/Commands/Validation/String";
import {FloatConverter} from "../Systems/Commands/Validation/Float";
import {getLogger} from "../Utilities/Logger";
import {setting} from "../Systems/Settings/decorators";
import {permission} from "../Systems/Permissions/decorators";
import {command} from "../Systems/Commands/decorators";
import {Argument, Channel, ResponseArg, RestArguments, Sender} from "../Systems/Commands/Validation/Argument";
import {Response} from "../Chat/Response";
import CheckPermission from "../Systems/Commands/Validation/CheckPermission";
import {CommandHandler} from "../Systems/Commands/Validation/CommandHandler";
import {BetService, PlaceBetResponse} from "../Services/BetService";

export const MODULE_INFO = {
    name: "Betting",
    version: "1.1.0",
    description: "Place bets using points on a specific options, the total points is divided among those who bet for the winning option."
};

const logger = getLogger(MODULE_INFO.name);

class BetCommand extends Command {
    private betService: BetService;

    constructor(private bettingModule: BettingModule) {
        super("bet", "<place|open|close|check>");

        this.betService = new BetService(bettingModule);
    }

    @CommandHandler("bet place", "<option> <amount>")
    @CheckPermission("bet.place")
    async place(
        event: CommandEvent, @ResponseArg response: Response, @Sender sender: ChatterEntity, @Channel channel: ChannelEntity,
        @Argument(StringConverter) option: string,
        @Argument(new FloatConverter({ min: 1 })) amount: number
    ): Promise<void> {
        try {
            const resp = await this.betService.placeBet(sender, option, amount, channel);
            if (resp === null) return;
            switch (resp) {
                case PlaceBetResponse.INVALID_OPTION: return await response.message("bet:error.invalid-option");
                case PlaceBetResponse.LOW_BALANCE: return await response.message("currency:error.low-balance", {
                    currency_name: await CurrencyModule.getPluralName(channel)
                });
                case PlaceBetResponse.TOO_LOW: return await response.message("bet:error.too-low");
                case PlaceBetResponse.TOO_HIGH: return await response.message("bet:error.too-high");
                case PlaceBetResponse.BET_PLACED: return await response.message("bet:placed", {
                    amount: await CurrencyModule.formatAmount(amount, channel), option
                });
            }
        } catch (e) {
            await response.genericErrorAndLog(e, logger);
        }
    }

    @CommandHandler("bet open", "\"<title>\" <option 1> <option 2> ... <option n>")
    @CheckPermission("bet.open")
    async open(
        event: CommandEvent, @ResponseArg response: Response, @Channel channel: ChannelEntity,
        @Argument(StringConverter) title: string,
        @RestArguments() options: string[]
    ): Promise<void> {
        if (this.betService.openBet(title, options, channel)) {
            return response.message("bet:opened", {title, options: options.join(", ")});
        } else {
            return response.message("bet:error.already-open");
        }
    }

    @CommandHandler("bet close", "<winning option>")
    @CheckPermission("bet.close")
    async close(
        event: CommandEvent, @ResponseArg response: Response, @Channel channel: ChannelEntity,
        @Argument(StringConverter, "winning option") option: string
    ): Promise<void> {
        const game = this.betService.getGame(channel);
        if (!game?.isOpen()) return response.message("bet:error.not-open");
        const winnings = await game?.close(option);

        if (winnings === null) return response.message("bet:error.invalid-option", {option});
        else return response.message("bet:closed", {
            title: game.getTitle(), option, winnings: await CurrencyModule.formatAmount(winnings, channel)
        });
    }

    @CommandHandler("bet check", "")
    @CheckPermission("bet.check")
    async check(
        event: CommandEvent, @ResponseArg response: Response, @Channel channel: ChannelEntity
    ): Promise<void> {
        const parts = [];
        const totals = this.betService.getTotals(channel);
        if (totals === null) return response.message("bet:error.no-recent");
        const {grandTotal, optionTotals} = totals;
        for (const [option, total] of optionTotals)
            parts.push(await response.translate("bet:check.part", {
                option,
                amount: await CurrencyModule.formatAmount(total, channel),
                percentage: (total / grandTotal) * 100
            }));
        await response.message("bet:check.full", {options: parts.join("; ")});
    }
}

export default class BettingModule extends AbstractModule {
    static [Symbols.ModuleInfo] = MODULE_INFO;

    constructor() {
        super(BettingModule);
    }

    @command betCommand = new BetCommand(this);

    @setting minimumBet = new Setting("bet.minimum", 1 as Integer, SettingType.INTEGER);
    @setting maximumBet = new Setting("bet.maximum", -1 as Integer, SettingType.INTEGER);

    @permission placeBet = new Permission("bet.place", Role.NORMAL);
    @permission openBet = new Permission("bet.open", Role.MODERATOR);
    @permission closeBet = new Permission("bet.close", Role.MODERATOR);
    @permission checkBet = new Permission("bet.check", Role.MODERATOR);
}