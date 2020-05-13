import Filter from "./Filter";
import FiltersEntity from "../../../Database/Entities/FiltersEntity";
import {MessageEventArgs} from "../../../Chat/Events/MessageEvent";
import StrikeManager from "../StrikeManager";
import SettingsSystem from "../../Settings/SettingsSystem";
import Setting, {SettingType} from "../../Settings/Setting";
import PermissionSystem from "../../Permissions/PermissionSystem";
import Permission from "../../Permissions/Permission";
import {Role} from "../../Permissions/Role";

export default class BadWordFilter extends Filter {
    constructor(strikeManager: StrikeManager) {
        super(strikeManager);

        const settings = SettingsSystem.getInstance();
        settings.registerSetting(new Setting("filter.bad-word.enabled", "true", SettingType.BOOLEAN));

        const perm = PermissionSystem.getInstance();
        perm.registerPermission(new Permission("filter.ignore.bad-word", Role.MODERATOR));
    }

    async handleMessage(lists: FiltersEntity, { message, sender, channel, response }: MessageEventArgs): Promise<boolean> {
        if (await message.checkPermission("filter.ignore.bad-word")) return false;
        const enabled = await channel.getSetting<boolean>("filter.bad-word.enabled");
        if (!enabled) return false;

        const badWords = lists.badWords;
        const lower = message.getRaw().toLowerCase();
        for (const badWord of badWords) {
            if (badWord.length < 1) continue; // Empty string
            if (lower.indexOf(badWord.toLowerCase()) >= 0) {
                await this.strikeManager.issueStrike("bad-word", message);
                return true;
            }
        }

        return false;
    }

}