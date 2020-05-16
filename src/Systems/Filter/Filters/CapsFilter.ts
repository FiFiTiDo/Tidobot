import Filter from "./Filter";
import FiltersEntity from "../../../Database/Entities/FiltersEntity";
import {MessageEventArgs} from "../../../Chat/Events/MessageEvent";
import StrikeManager from "../StrikeManager";
import SettingsSystem from "../../Settings/SettingsSystem";
import Setting, {SettingType} from "../../Settings/Setting";
import PermissionSystem from "../../Permissions/PermissionSystem";
import Permission from "../../Permissions/Permission";
import {Role} from "../../Permissions/Role";

const CAPS_PATTERN = /([A-Z])/g;

export default class CapsFilter extends Filter {
    constructor(strikeManager: StrikeManager) {
        super(strikeManager);

        const settings = SettingsSystem.getInstance();
        settings.registerSetting(new Setting("filter.caps.enabled", "true", SettingType.BOOLEAN));
        settings.registerSetting(new Setting("filter.caps.percent", "80", SettingType.INTEGER));
        settings.registerSetting(new Setting("filter.caps.min-length", "10", SettingType.INTEGER));

        const perm = PermissionSystem.getInstance();
        perm.registerPermission(new Permission("filter.ignore.caps", Role.MODERATOR));
    }

    async handleMessage(lists: FiltersEntity, {message, channel}: MessageEventArgs): Promise<boolean> {
        if (await message.checkPermission("filter.ignore.caps")) return false;
        const enabled = await channel.getSetting<boolean>("filter.caps.enabled");
        if (!enabled) return false;

        const stripped = message.getStripped();
        const minLength = await channel.getSetting<number>("filter.caps.min-length");
        if (stripped.length < minLength) return false;

        const maxPercent = await channel.getSetting<number>("filter.caps.percent");
        const caps = stripped.match(CAPS_PATTERN) || [];
        const percent = (caps.length / stripped.length) * 100;
        if (percent >= maxPercent) {
            await this.strikeManager.issueStrike("caps", message);
            return true;
        }

        return false;
    }
}