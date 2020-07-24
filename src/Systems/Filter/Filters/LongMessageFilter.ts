import Filter from "./Filter";
import FiltersEntity from "../../../Database/Entities/FiltersEntity";
import {MessageEventArgs} from "../../../Chat/Events/MessageEvent";
import StrikeManager from "../StrikeManager";
import Setting, {Integer, SettingType} from "../../Settings/Setting";
import SettingsSystem from "../../Settings/SettingsSystem";
import PermissionSystem from "../../Permissions/PermissionSystem";
import Permission from "../../Permissions/Permission";
import {Role} from "../../Permissions/Role";

export default class LongMessageFilter extends Filter {
    private static ENABLED = new Setting("filter.long-message.enabled", true, SettingType.BOOLEAN);
    private static LENGTH = new Setting("filter.long-message.length", 325 as Integer, SettingType.INTEGER);

    private static IGNORE_FILTER = new Permission("filter.ignore.long-message", Role.MODERATOR);

    constructor(strikeManager: StrikeManager) {
        super(strikeManager);

        const settings = SettingsSystem.getInstance();
        settings.registerSetting(LongMessageFilter.ENABLED);
        settings.registerSetting(LongMessageFilter.LENGTH);

        const perm = PermissionSystem.getInstance();
        perm.registerPermission(LongMessageFilter.IGNORE_FILTER);
    }

    async handleMessage(lists: FiltersEntity, {message, sender, channel, response}: MessageEventArgs): Promise<boolean> {
        if (await message.checkPermission(LongMessageFilter.IGNORE_FILTER)) return false;
        if (!(await channel.getSetting(LongMessageFilter.ENABLED))) return false;
        const maxLength = await channel.getSetting(LongMessageFilter.LENGTH);
        const msgLength = message.getRaw().length;

        if (msgLength < maxLength) return false;

        await this.strikeManager.issueStrike("long-message", message);
        return true;
    }

}