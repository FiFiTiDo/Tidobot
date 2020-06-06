import AbstractModule, {ModuleInfo, Symbols, Systems} from "./AbstractModule";
import {getLogger} from "../Utilities/Logger";
import Command from "../Systems/Commands/Command";
import {CommandEventArgs} from "../Systems/Commands/CommandEvent";
import Permission from "../Systems/Permissions/Permission";
import {Role} from "../Systems/Permissions/Role";
import Setting, {Float, SettingType} from "../Systems/Settings/Setting";
import {setting} from "../Systems/Settings/decorators";
import {command} from "../Systems/Commands/decorators";
import {permission} from "../Systems/Permissions/decorators";

export const MODULE_INFO = {
    name: "Gambling",
    version: "1.0.0",
    description: "Gamble your points away or take a chance at the slot machines!"
};

const logger = getLogger(MODULE_INFO.name);

class SlotsCommand extends Command {
    constructor(private gamblingModule: GamblingModule) {
        super("slots", "");
    }

    async execute({}: CommandEventArgs): Promise<void> {

    }
}

export default class GamblingModule extends AbstractModule {
    static [Symbols.ModuleInfo] = MODULE_INFO;

    constructor() {
        super(GamblingModule);
    }

    @command slotsCommand = new SlotsCommand(this);

    @permission playSlots = new Permission("gambling.slots", Role.NORMAL);

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