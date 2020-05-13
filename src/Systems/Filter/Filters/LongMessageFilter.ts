import Filter from "./Filter";
import FiltersEntity from "../../../Database/Entities/FiltersEntity";
import {MessageEventArgs} from "../../../Chat/Events/MessageEvent";
import StrikeManager from "../StrikeManager";
import Setting, {SettingType} from "../../Settings/Setting";
import SettingsSystem from "../../Settings/SettingsSystem";
import PermissionSystem from "../../Permissions/PermissionSystem";
import Permission from "../../Permissions/Permission";
import {Role} from "../../Permissions/Role";

export default class LongMessageFilter extends Filter {
    constructor(strikeManager: StrikeManager) {
        super(strikeManager);

        const settings = SettingsSystem.getInstance();
        settings.registerSetting(new Setting("filter.long-message.enabled", "true", SettingType.BOOLEAN));
        settings.registerSetting(new Setting("filter.long-message.length", "325", SettingType.INTEGER));

        const perm = PermissionSystem.getInstance();
        perm.registerPermission(new Permission("filter.ignore.long-message", Role.MODERATOR));
    }

    async handleMessage(lists: FiltersEntity, { message, sender, channel, response }: MessageEventArgs): Promise<boolean> {
        if (await message.checkPermission("filter.ignore.long-message")) return false;
        const enabled = await channel.getSetting<boolean>("filter.long-message.enabled");
        if (!enabled) return false;
        const maxLength = await channel.getSetting<number>("filter.long-message.length");
        const msgLength = message.getRaw().length;

        if (msgLength >= maxLength) {
            await this.strikeManager.issueStrike("long-message", message);
            return;
        }

        return false;
    }

}