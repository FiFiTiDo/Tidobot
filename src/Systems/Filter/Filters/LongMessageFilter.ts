import Filter from "./Filter";
import {MessageEventArgs} from "../../../Chat/Events/MessageEvent";
import Setting, {Integer, SettingType} from "../../Settings/Setting";
import SettingsSystem from "../../Settings/SettingsSystem";
import PermissionSystem from "../../Permissions/PermissionSystem";
import Permission from "../../Permissions/Permission";
import {Role} from "../../Permissions/Role";
import { Service } from "typedi";

@Service()
export default class LongMessageFilter extends Filter {
    private static ENABLED = new Setting("filter.long-message.enabled", true, SettingType.BOOLEAN);
    private static LENGTH = new Setting("filter.long-message.length", 325 as Integer, SettingType.INTEGER);

    private static IGNORE_FILTER = new Permission("filter.ignore.long-message", Role.MODERATOR);

    constructor(settings: SettingsSystem, perm: PermissionSystem) {
        super();

        settings.registerSetting(LongMessageFilter.ENABLED);
        settings.registerSetting(LongMessageFilter.LENGTH);
        perm.registerPermission(LongMessageFilter.IGNORE_FILTER);
    }

    async handleMessage({message, channel}: MessageEventArgs): Promise<boolean> {
        if (await message.checkPermission(LongMessageFilter.IGNORE_FILTER)) return false;
        if (!channel.settings.get(LongMessageFilter.ENABLED)) return false;
        const maxLength = channel.settings.get(LongMessageFilter.LENGTH);
        const msgLength = message.getRaw().length;

        if (msgLength < maxLength) return false;

        await this.strikeManager.issueStrike("long-message", message);
        return true;
    }

}