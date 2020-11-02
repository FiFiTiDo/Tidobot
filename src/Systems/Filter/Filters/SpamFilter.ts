import Filter from "./Filter";
import {MessageEventArgs} from "../../../Chat/Events/MessageEvent";
import SettingsSystem from "../../Settings/SettingsSystem";
import Setting, {Integer, SettingType} from "../../Settings/Setting";
import PermissionSystem from "../../Permissions/PermissionSystem";
import Permission from "../../Permissions/Permission";
import {Role} from "../../Permissions/Role";
import MessageCache from "../MessageCache";
import { Service } from "typedi";

@Service()
export default class SpamFilter extends Filter {
    public static AMOUNT = new Setting("filter.spam.amount", 15 as Integer, SettingType.INTEGER);
    public static SIMILARITY = new Setting("filter.spam.similarity", 90 as Integer, SettingType.INTEGER);
    private static ENABLED = new Setting("filter.spam.enabled", true, SettingType.BOOLEAN);
    private static IGNORE_FILTER = new Permission("filter.ignore.spam", Role.MODERATOR);

    constructor(settings: SettingsSystem, perm: PermissionSystem, private messageCache: MessageCache) {
        super();

        settings.registerSetting(SpamFilter.ENABLED);
        settings.registerSetting(SpamFilter.AMOUNT);
        settings.registerSetting(SpamFilter.SIMILARITY);
        perm.registerPermission(SpamFilter.IGNORE_FILTER);
    }

    async handleMessage({message, channel}: MessageEventArgs): Promise<boolean> {
        if (await message.checkPermission(SpamFilter.IGNORE_FILTER)) return false;
        if (!channel.settings.get(SpamFilter.ENABLED)) return false;
        if (!(await this.messageCache.checkSpam(message))) return false;

        await this.strikeManager.issueStrike("spam", message);
        return true;
    }

}