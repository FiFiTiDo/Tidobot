import Filter from "./Filter";
import FiltersEntity from "../../../Database/Entities/FiltersEntity";
import {MessageEventArgs} from "../../../Chat/Events/MessageEvent";
import StrikeManager from "../StrikeManager";
import SettingsSystem from "../../Settings/SettingsSystem";
import Setting, {SettingType} from "../../Settings/Setting";
import PermissionSystem from "../../Permissions/PermissionSystem";
import Permission from "../../Permissions/Permission";
import {Role} from "../../Permissions/Role";

const CAPS_PATTERN = /[A-Z]/g;

export default class CapsFilter extends Filter {
    constructor(strikeManager: StrikeManager) {
        super(strikeManager);

        const settings = SettingsSystem.getInstance();
        settings.registerSetting(new Setting("filter.caps.enabled", "true", SettingType.BOOLEAN));
        settings.registerSetting(new Setting("filter.caps.percent", "80", SettingType.INTEGER));

        const perm = PermissionSystem.getInstance();
        perm.registerPermission(new Permission("filter.ignore.caps", Role.MODERATOR));
    }

    async handleMessage(lists: FiltersEntity, { message }: MessageEventArgs): Promise<boolean> {
        if (await message.checkPermission("filter.ignore.caps")) return false;
        const enabled = await message.getChannel().getSettings().get("filter.caps.enabled");
        if (!enabled) return false;

        const maxPercent = await message.getChannel().getSettings().get("filter.caps.percent");
        const caps = message.getRaw().match(CAPS_PATTERN) || [];
        const percent = (caps.length / message.getRaw().length) * 100;

        if (percent >= maxPercent) {
            await this.strikeManager.issueStrike("caps", message);
            return true;
        }

        return false;
    }
}