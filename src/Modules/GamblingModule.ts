import AbstractModule, {ModuleInfo, Systems} from "./AbstractModule";
import {getLogger} from "../Utilities/Logger";
import Command from "../Systems/Commands/Command";
import {CommandEventArgs} from "../Systems/Commands/CommandEvent";
import Permission from "../Systems/Permissions/Permission";
import {Role} from "../Systems/Permissions/Role";
import Setting, {SettingType} from "../Systems/Settings/Setting";

export const MODULE_INFO = {
    name: "Gambling",
    version: "1.0.0",
    description: "Gamble your points away or take a chance at the slot machines!"
};

const logger = getLogger(MODULE_INFO.name);

class SlotsCommand extends Command {
    constructor() {
        super("slots", "");
    }

    async execute({}: CommandEventArgs): Promise<void> {

    }
}

export default class GamblingModule extends AbstractModule {
    constructor() {
        super(GamblingModule.name);
    }

    initialize({ command, permission, settings }: Systems): ModuleInfo {
        command.registerCommand(new SlotsCommand(), this);
        permission.registerPermission(new Permission("gambling.slots", Role.NORMAL));
        settings.registerSetting(new Setting("slots.prize.0", "75", SettingType.FLOAT));
        settings.registerSetting(new Setting("slots.prize.1", "150", SettingType.FLOAT));
        settings.registerSetting(new Setting("slots.prize.2", "300", SettingType.FLOAT));
        settings.registerSetting(new Setting("slots.prize.3", "450", SettingType.FLOAT));
        settings.registerSetting(new Setting("slots.prize.4", "1000", SettingType.FLOAT));
        settings.registerSetting(new Setting("slots.emote.0", "Kappa", SettingType.STRING));
        settings.registerSetting(new Setting("slots.emote.1", "KappaPride", SettingType.STRING));
        settings.registerSetting(new Setting("slots.emote.2", "BloodTrail", SettingType.STRING));
        settings.registerSetting(new Setting("slots.emote.3", "ResidentSleeper", SettingType.STRING));
        settings.registerSetting(new Setting("slots.emote.4", "4Head", SettingType.STRING));

        return MODULE_INFO;
    }
}