import AbstractModule, {Symbols} from "./AbstractModule";
import Command from "../Systems/Commands/Command";
import {CommandEvent} from "../Systems/Commands/CommandEvent";
import Permission from "../Systems/Permissions/Permission";
import {Role} from "../Systems/Permissions/Role";
import Setting, {Float, SettingType} from "../Systems/Settings/Setting";
import {randomFloat} from "../Utilities/RandomUtils";
import {arrayRand} from "../Utilities/ArrayUtils";
import {CommandHandler} from "../Systems/Commands/Validation/CommandHandler";
import CheckPermission from "../Systems/Commands/Validation/CheckPermission";
import {ChannelArg, ResponseArg, Sender} from "../Systems/Commands/Validation/Argument";
import {Response} from "../Chat/Response";
import { Service } from "typedi";
import { Channel } from "../Database/Entities/Channel";
import { Chatter } from "../Database/Entities/Chatter";
import { CurrencySystem } from "../Systems/Currency/CurrencySystem";

export const MODULE_INFO = {
    name: "Gambling",
    version: "1.2.0",
    description: "Gamble your points away or take a chance at the slot machines!"
};

@Service()
class SlotsCommand extends Command {
    constructor(private readonly currencySystem: CurrencySystem) {
        super("slots", "");
    }

    getPrizes(channel: Channel): [Float, Float, Float, Float, Float] {
        return [
            channel.settings.get(GamblingModule.settings.slotsPrize0),
            channel.settings.get(GamblingModule.settings.slotsPrize1),
            channel.settings.get(GamblingModule.settings.slotsPrize2),
            channel.settings.get(GamblingModule.settings.slotsPrize3),
            channel.settings.get(GamblingModule.settings.slotsPrize4),
        ];
    }

    getEmotes(channel: Channel): [string, string, string, string, string] {
        return [
            channel.settings.get(GamblingModule.settings.slotsEmote0),
            channel.settings.get(GamblingModule.settings.slotsEmote1),
            channel.settings.get(GamblingModule.settings.slotsEmote2),
            channel.settings.get(GamblingModule.settings.slotsEmote3),
            channel.settings.get(GamblingModule.settings.slotsEmote4),
        ];
    }

    getRandomIndex(): number {
        const number = randomFloat();
        if (number <= 0.075) return 4;
        else if (number <= 0.2) return 3;
        else if (number <= 0.45) return 2;
        else if (number <= 0.7) return 1;
        else return 0;
    }

    @CommandHandler("slots", "slots")
    @CheckPermission(() => GamblingModule.permissions.playSlots)
    async handleCommand(
        event: CommandEvent, @ResponseArg response: Response, @ChannelArg channel: Channel, @Sender sender: Chatter
    ): Promise<void> {
        if (!await sender.charge(channel.settings.get(GamblingModule.settings.slotsPrice))) return;

        const emotes = this.getEmotes(channel);
        const prizes = this.getPrizes(channel);
        const emote1 = this.getRandomIndex(), emote2 = this.getRandomIndex(), emote3 = this.getRandomIndex();
        let message = await response.translate("gambling:slots.emotes", {
            username: sender.user.name, emote1: emotes[emote1], emote2: emotes[emote2], emote3: emotes[emote3]
        });

        let winnings = 0;
        if (emote1 === emote2 && emote2 === emote3) {
            winnings = prizes[emote1];
        } else if (emote1 === emote2) {
            winnings = Math.floor(prizes[emote1] * 0.3);
        } else if (emote2 === emote3 || emote3 === emote1) {
            winnings = Math.floor(prizes[emote3] * 0.3);
        }

        if (winnings > 0) {
            await sender.deposit(winnings);
            message += " " + await response.translate("gambling:slots.win", {
                amount: this.currencySystem.formatAmount(winnings, channel)
            });
            message += " " + arrayRand(await response.getTranslation<string[]>("gambling:win"));
        } else {
            message += " " + arrayRand(await response.getTranslation<string[]>("gambling:loss"));
        }

        return response.rawMessage(message);
    }
}

@Service()
export default class GamblingModule extends AbstractModule {
    static [Symbols.ModuleInfo] = MODULE_INFO;
    static permissions = {
        playSlots: new Permission("gambling.slots", Role.NORMAL)
    }
    static settings = {
        slotsPrice: new Setting("slots.price", 75 as Float, SettingType.FLOAT),
        slotsPrize0: new Setting("slots.prize.0", 75 as Float, SettingType.FLOAT),
        slotsPrize1: new Setting("slots.prize.1", 150 as Float, SettingType.FLOAT),
        slotsPrize2: new Setting("slots.prize.2", 300 as Float, SettingType.FLOAT),
        slotsPrize3: new Setting("slots.prize.3", 450 as Float, SettingType.FLOAT),
        slotsPrize4: new Setting("slots.prize.4", 1000 as Float, SettingType.FLOAT),
        slotsEmote0: new Setting("slots.emote.0", "Kappa", SettingType.STRING),
        slotsEmote1: new Setting("slots.emote.1", "KappaPride", SettingType.STRING),
        slotsEmote2: new Setting("slots.emote.2", "BloodTrail", SettingType.STRING),
        slotsEmote3: new Setting("slots.emote.3", "ResidentSleeper", SettingType.STRING),
        slotsEmote4: new Setting("slots.emote.4", "4Head", SettingType.STRING)
    }

    constructor(
        slotsCommand: SlotsCommand
    ) {
        super(GamblingModule);

        this.registerCommand(slotsCommand);
        this.registerPermissions(GamblingModule.permissions);
        this.registerSettings(GamblingModule.settings);
    }
}