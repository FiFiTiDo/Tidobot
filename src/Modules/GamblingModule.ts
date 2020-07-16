import AbstractModule, {Symbols} from "./AbstractModule";
import {getLogger} from "../Utilities/Logger";
import Command from "../Systems/Commands/Command";
import {CommandEvent} from "../Systems/Commands/CommandEvent";
import Permission from "../Systems/Permissions/Permission";
import {Role} from "../Systems/Permissions/Role";
import Setting, {Float, SettingType} from "../Systems/Settings/Setting";
import {setting} from "../Systems/Settings/decorators";
import {command} from "../Systems/Commands/decorators";
import {permission} from "../Systems/Permissions/decorators";
import ChannelEntity from "../Database/Entities/ChannelEntity";
import {randomFloat} from "../Utilities/RandomUtils";
import CurrencyModule from "./CurrencyModule";
import {array_rand} from "../Utilities/ArrayUtils";
import {CommandHandler} from "../Systems/Commands/Validation/CommandHandler";
import CheckPermission from "../Systems/Commands/Validation/CheckPermission";
import {Channel, ResponseArg, Sender} from "../Systems/Commands/Validation/Argument";
import {Response} from "../Chat/Response";
import ChatterEntity from "../Database/Entities/ChatterEntity";

export const MODULE_INFO = {
    name: "Gambling",
    version: "1.1.0",
    description: "Gamble your points away or take a chance at the slot machines!"
};

const logger = getLogger(MODULE_INFO.name);

class SlotsCommand extends Command {
    constructor(private gamblingModule: GamblingModule) {
        super("slots", "");
    }

    async getPrizes(channel: ChannelEntity): Promise<[Float, Float, Float, Float, Float]> {
        return [
            await channel.getSetting(this.gamblingModule.slotsPrize0),
            await channel.getSetting(this.gamblingModule.slotsPrize1),
            await channel.getSetting(this.gamblingModule.slotsPrize2),
            await channel.getSetting(this.gamblingModule.slotsPrize3),
            await channel.getSetting(this.gamblingModule.slotsPrize4),
        ]
    }

    async getEmotes(channel: ChannelEntity): Promise<[string, string, string, string, string]> {
        return [
            await channel.getSetting(this.gamblingModule.slotsEmote0),
            await channel.getSetting(this.gamblingModule.slotsEmote1),
            await channel.getSetting(this.gamblingModule.slotsEmote2),
            await channel.getSetting(this.gamblingModule.slotsEmote3),
            await channel.getSetting(this.gamblingModule.slotsEmote4),
        ]
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
    @CheckPermission("gambling.slots")
    async handleCommand(
        event: CommandEvent, @ResponseArg response: Response, @Channel channel: ChannelEntity, @Sender sender: ChatterEntity
    ): Promise<void> {
        if (!await sender.charge(await channel.getSetting(this.gamblingModule.slotsPrice))) return;

        const emotes = await this.getEmotes(channel);
        const prizes = await this.getPrizes(channel);
        const emote1 = this.getRandomIndex(), emote2 = this.getRandomIndex(), emote3 = this.getRandomIndex();
        let message = await response.translate("gambling:slots.emotes", {
            username: sender.name, emote1: emotes[emote1], emote2: emotes[emote2], emote3: emotes[emote3]
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
                amount: await CurrencyModule.formatAmount(winnings, channel)
            });
            message += " " + array_rand(await response.getTranslation<string[]>("gambling:win"));
        } else {
            message += " " + array_rand(await response.getTranslation<string[]>("gambling:loss"));
        }

        return response.rawMessage(message);
    }
}

export default class GamblingModule extends AbstractModule {
    static [Symbols.ModuleInfo] = MODULE_INFO;

    constructor() {
        super(GamblingModule);
    }

    @command slotsCommand = new SlotsCommand(this);

    @permission playSlots = new Permission("gambling.slots", Role.NORMAL);

    @setting slotsPrice = new Setting("slots.price", 75 as Float, SettingType.FLOAT);
    @setting slotsPrize0 = new Setting("slots.prize.0", 75 as Float, SettingType.FLOAT);
    @setting slotsPrize1 = new Setting("slots.prize.1", 150 as Float, SettingType.FLOAT);
    @setting slotsPrize2 = new Setting("slots.prize.2", 300 as Float, SettingType.FLOAT);
    @setting slotsPrize3 = new Setting("slots.prize.3", 450 as Float, SettingType.FLOAT);
    @setting slotsPrize4 = new Setting("slots.prize.4", 1000 as Float, SettingType.FLOAT);
    @setting slotsEmote0 = new Setting("slots.emote.0", "Kappa", SettingType.STRING);
    @setting slotsEmote1 = new Setting("slots.emote.1", "KappaPride", SettingType.STRING);
    @setting slotsEmote2 = new Setting("slots.emote.2", "BloodTrail", SettingType.STRING);
    @setting slotsEmote3 = new Setting("slots.emote.3", "ResidentSleeper", SettingType.STRING);
    @setting slotsEmote4 = new Setting("slots.emote.4", "4Head", SettingType.STRING);
}