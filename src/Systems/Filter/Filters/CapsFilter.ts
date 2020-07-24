import Filter from "./Filter";
import FiltersEntity from "../../../Database/Entities/FiltersEntity";
import {MessageEventArgs} from "../../../Chat/Events/MessageEvent";
import StrikeManager from "../StrikeManager";
import SettingsSystem from "../../Settings/SettingsSystem";
import Setting, {Integer, SettingType} from "../../Settings/Setting";
import PermissionSystem from "../../Permissions/PermissionSystem";
import Permission from "../../Permissions/Permission";
import {Role} from "../../Permissions/Role";

const CAPS_PATTERN = /([A-Z])/g;

export default class CapsFilter extends Filter {
    private static ENABLED = new Setting("filter.caps.enabled", true, SettingType.BOOLEAN);
    private static PERCENT = new Setting("filter.caps.percent", 80 as Integer, SettingType.INTEGER);
    private static MIN_LENGTH = new Setting("filter.caps.min-length", 10 as Integer, SettingType.INTEGER);

    private static IGNORE_FILTER = new Permission("filter.ignore.caps", Role.MODERATOR);

    constructor(strikeManager: StrikeManager) {
        super(strikeManager);

        const settings = SettingsSystem.getInstance();
        settings.registerSetting(CapsFilter.ENABLED);
        settings.registerSetting(CapsFilter.PERCENT);
        settings.registerSetting(CapsFilter.MIN_LENGTH);

        const perm = PermissionSystem.getInstance();
        perm.registerPermission(CapsFilter.IGNORE_FILTER);
    }

    async handleMessage(lists: FiltersEntity, {message, channel}: MessageEventArgs): Promise<boolean> {
        if (await message.checkPermission(CapsFilter.IGNORE_FILTER)) return false;
        if (!(await channel.getSetting(CapsFilter.ENABLED))) return false;

        const stripped = message.getStripped();
        const minLength = await channel.getSetting(CapsFilter.MIN_LENGTH);
        if (stripped.length < minLength) return false;

        const maxPercent = await channel.getSetting(CapsFilter.PERCENT);
        const caps = stripped.match(CAPS_PATTERN) || [];
        const percent = (caps.length / stripped.length) * 100;

        if (percent < maxPercent) return false;

        await this.strikeManager.issueStrike("caps", message);
        return true;
    }
}