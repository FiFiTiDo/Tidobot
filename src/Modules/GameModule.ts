import { Service } from "typedi";
import Message from "../Chat/Message";
import { Response } from "../Chat/Response";
import { Channel } from "../Database/Entities/Channel";
import { Chatter } from "../Database/Entities/Chatter";
import { AdventureService as AdventureService, EnterResult } from "../Services/AdventureService";
import Command from "../Systems/Commands/Command";
import { Argument, ChannelArg, MessageArg, ResponseArg, Sender } from "../Systems/Commands/Validation/Argument";
import CheckPermission from "../Systems/Commands/Validation/CheckPermission";
import { CommandHandler } from "../Systems/Commands/Validation/CommandHandler";
import { FloatArg } from "../Systems/Commands/Validation/Float";
import { CurrencyType } from "../Systems/Currency/CurrencyType";
import Event from "../Systems/Event/Event";
import Permission from "../Systems/Permissions/Permission";
import { Role } from "../Systems/Permissions/Role";
import Setting, { Float, Integer, SettingType } from "../Systems/Settings/Setting";
import AbstractModule, { Symbols } from "./AbstractModule";

export const MODULE_INFO = {
    name: "Game",
    version: "1.1.0",
    description: "A module that includes fun games that can be played in chat"
};

@Service()
class AdventureCommand extends Command {
    constructor(private readonly adventureService: AdventureService) {
        super("adventure", "<amount>", ["adv"]);
    }

    @CommandHandler(/^adv(enture)?/, "adventure <amount>")
    @CheckPermission(() => GameModule.permissions.JOIN_ADVENTURE)
    async handleCommand(
        event: Event, @ResponseArg response: Response, @ChannelArg channel: Channel, @Sender sender: Chatter, @MessageArg message: Message,
        @Argument(new FloatArg({ min: 1 })) amount: number
    ): Promise<void> {
        const result = await this.adventureService.enterGame(message, amount);

        switch(result) {
            case EnterResult.SUCCESSFUL:
                return response.message("adventure:enter.successful", { username: sender.user.name });
            case EnterResult.STARTED:
                return response.message("adventure:start", { username: sender.user.name, usage: this.formatUsage(channel) });
            case EnterResult.ALREADY_STARTED:
                return response.message("adventure:enter.already-started", { username: sender.user.name });
            case EnterResult.TOO_LOW: {
                const currencyType = CurrencyType.get(channel);
                const min = currencyType.formatAmount(channel.settings.get(GameModule.settings.ADVENTURE_MIN_BET));
                const amountStr = currencyType.formatAmount(amount);
                return response.message("adventure:enter.too-low", { username: sender.user.name, amount: amountStr, min });
            }
            case EnterResult.TOO_HIGH: {
                const currencyType = CurrencyType.get(channel);
                const max = currencyType.formatAmount(channel.settings.get(GameModule.settings.ADVENTURE_MAX_BET));
                const amountStr = currencyType.formatAmount(amount);
                return response.message("adventure:enter.too-high", { username: sender.user.name, amount: amountStr, min: max });
            }
            case EnterResult.NOT_ENOUGH:
                return response.message("adventure:enter.too-high", { username: sender.user.name });
            case EnterResult.ALREADY_ENTERED:
                return response.message("adventure:enter.already-entered", { username: sender.user.name });
            case EnterResult.CANNOT_START:
                return response.message("adventure:enter.cannot-start", { username: sender.user.name });
            case EnterResult.COOLDOWN:
                return response.message("adventure:enter.cooldown");
        }
    }
}

@Service()
class CancelAdventureCommand extends Command {
    constructor(private readonly adventureService: AdventureService) {
        super("canceladventure", null, ["canceladv"]);
    }

    @CommandHandler(/^canceladv(enture)?/, "canceladventure")
    @CheckPermission(() => GameModule.permissions.CANCEL_ADVENTURE)
    async handleCommand(event: Event, @ResponseArg response: Response, @ChannelArg channel: Channel): Promise<void> {
        const game = this.adventureService.getGame(channel);
        if (!game.present || game.value.hasEnded())
            return response.message("adventure:cancel.no-adventure");
        await game.value.cancel();
        await response.message("adventure:cancel.successful");
    }
}

@Service()
export default class GameModule extends AbstractModule {
    static [Symbols.ModuleInfo] = MODULE_INFO;
    static permissions = {
        JOIN_ADVENTURE: new Permission("adventure.play", Role.NORMAL),
        START_ADVENTURE: new Permission("adventure.start", Role.NORMAL),
        CANCEL_ADVENTURE: new Permission("adventure.cancel", Role.MODERATOR)
    }
    static settings = {
        ADVENTURE_SURVIVAL_CHANCE: new Setting("adventure.survival-chance", 0.75 as Float, SettingType.FLOAT),
        ADVENTURE_COOLDOWN: new Setting("adventure.cooldown", 900 as Integer, SettingType.INTEGER),
        ADVENTURE_GAIN_PERCENT: new Setting("adventure.gain-percent", 30 as Integer, SettingType.INTEGER),
        ADVENTURE_WAIT_TIME: new Setting("adventure.wait-time", 60 as Integer, SettingType.INTEGER),
        ADVENTURE_MIN_BET: new Setting("adventure.min-bet", 10 as Float, SettingType.FLOAT),
        ADVENTURE_MAX_BET: new Setting("adventure.max-bet", 1000 as Float, SettingType.FLOAT),
    }

    constructor(adventureCommand: AdventureCommand, cancelAdventureCommand: CancelAdventureCommand) {
        super(GameModule);

        this.registerCommands(adventureCommand, cancelAdventureCommand);
        this.registerPermissions(GameModule.permissions);
        this.registerSettings(GameModule.settings);
    }
}