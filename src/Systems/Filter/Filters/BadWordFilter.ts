import Filter from "./Filter";
import SettingsSystem from "../../Settings/SettingsSystem";
import Setting, {SettingType} from "../../Settings/Setting";
import PermissionSystem from "../../Permissions/PermissionSystem";
import Permission from "../../Permissions/Permission";
import {Role} from "../../Permissions/Role";
import { Service } from "typedi";
import Message from "../../../Chat/Message";

@Service()
export default class BadWordFilter extends Filter {
    private static ENABLED = new Setting("filter.bad-word.enabled", true, SettingType.BOOLEAN);

    private static IGNORE_FILTER = new Permission("filter.ignore.bad-word", Role.MODERATOR);

    constructor(settings: SettingsSystem, perm: PermissionSystem) {
        super();

        settings.registerSetting(BadWordFilter.ENABLED);
        perm.registerPermission(BadWordFilter.IGNORE_FILTER);
    }

    async handleMessage(message: Message): Promise<boolean> {
        const channel = message.channel;
        if (await message.checkPermission(BadWordFilter.IGNORE_FILTER)) return false;
        if (!channel.settings.get(BadWordFilter.ENABLED)) return false;

        const badWords = channel.badWords;
        const lower = message.getRaw().toLowerCase();
        const strike = badWords
            .map(badWord => badWord.value.toLowerCase())
            .filter(badWord => badWord.length >= 1)
            .some(badWord => lower.includes(badWord));
        if (strike) await this.strikeManager.issueStrike("bad-word", message);
        return strike;
    }

}