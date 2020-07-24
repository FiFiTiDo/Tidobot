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
    private static ENABLED = new Setting("filter.bad-word.enabled", true, SettingType.BOOLEAN);

    private static IGNORE_FILTER = new Permission("filter.ignore.bad-word", Role.MODERATOR);

    constructor(strikeManager: StrikeManager) {
        super(strikeManager);

        const settings = SettingsSystem.getInstance();
        settings.registerSetting(BadWordFilter.ENABLED);

        const perm = PermissionSystem.getInstance();
        perm.registerPermission(BadWordFilter.IGNORE_FILTER);
    }

    async handleMessage(lists: FiltersEntity, {message, sender, channel, response}: MessageEventArgs): Promise<boolean> {
        if (await message.checkPermission(BadWordFilter.IGNORE_FILTER)) return false;
        if (!(await channel.getSetting(BadWordFilter.ENABLED))) return false;

        const badWords = lists.badWords;
        const lower = message.getRaw().toLowerCase();
        const strike = badWords
            .filter(badWord => badWord.length >= 1)
            .map(badWord => badWord.toLowerCase())
            .some(badWord => lower.includes(badWord));
        if (strike) await this.strikeManager.issueStrike("bad-word", message);
        return strike;
    }

}