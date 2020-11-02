import Filter from "./Filter";
import {MessageEventArgs} from "../../../Chat/Events/MessageEvent";
import SettingsSystem from "../../Settings/SettingsSystem";
import Setting, {Integer, SettingType} from "../../Settings/Setting";
import PermissionSystem from "../../Permissions/PermissionSystem";
import Permission from "../../Permissions/Permission";
import {Role} from "../../Permissions/Role";
import { Service } from "typedi";

const CAPS_PATTERN = /([A-Z])/g;

@Service()
export default class CapsFilter extends Filter {
    private static ENABLED = new Setting("filter.caps.enabled", true, SettingType.BOOLEAN);
    private static PERCENT = new Setting("filter.caps.percent", 80 as Integer, SettingType.INTEGER);
    private static MIN_LENGTH = new Setting("filter.caps.min-length", 10 as Integer, SettingType.INTEGER);

    private static IGNORE_FILTER = new Permission("filter.ignore.caps", Role.MODERATOR);

    constructor(settings: SettingsSystem, perm: PermissionSystem) {
        super();

        settings.registerSetting(CapsFilter.ENABLED);
        settings.registerSetting(CapsFilter.PERCENT);
        settings.registerSetting(CapsFilter.MIN_LENGTH);
        perm.registerPermission(CapsFilter.IGNORE_FILTER);
    }

    async handleMessage({message, channel}: MessageEventArgs): Promise<boolean> {
        if (await message.checkPermission(CapsFilter.IGNORE_FILTER)) return false;
        if (!channel.settings.get(CapsFilter.ENABLED)) return false;

        const stripped = message.getStripped();
        const minLength = channel.settings.get(CapsFilter.MIN_LENGTH);
        if (stripped.length < minLength) return false;

        const maxPercent = channel.settings.get(CapsFilter.PERCENT);
        const caps = stripped.match(CAPS_PATTERN) || [];
        const percent = (caps.length / stripped.length) * 100;

        if (percent < maxPercent) return false;

        await this.strikeManager.issueStrike("caps", message);
        return true;
    }
}