import Filter from "./Filter";
import FiltersEntity from "../../../Database/Entities/FiltersEntity";
import {MessageEventArgs} from "../../../Chat/Events/MessageEvent";
import SettingsSystem from "../../Settings/SettingsSystem";
import Setting, {Integer, SettingType} from "../../Settings/Setting";
import StrikeManager from "../StrikeManager";
import PermissionSystem from "../../Permissions/PermissionSystem";
import Permission from "../../Permissions/Permission";
import {Role} from "../../Permissions/Role";
import MessageCache from "../MessageCache";


export default class SpamFilter extends Filter {
    public static AMOUNT = new Setting("filter.spam.amount", 15 as Integer, SettingType.INTEGER);
    public static SIMILARITY = new Setting("filter.spam.similarity", 90 as Integer, SettingType.INTEGER);
    private static ENABLED = new Setting("filter.spam.enabled", true, SettingType.BOOLEAN);
    private static IGNORE_FILTER = new Permission("filter.ignore.spam", Role.MODERATOR);

    constructor(strikeManager: StrikeManager, private messageCache: MessageCache) {
        super(strikeManager);

        const settings = SettingsSystem.getInstance();
        settings.registerSetting(SpamFilter.ENABLED);
        settings.registerSetting(SpamFilter.AMOUNT);
        settings.registerSetting(SpamFilter.SIMILARITY);

        const perm = PermissionSystem.getInstance();
        perm.registerPermission(SpamFilter.IGNORE_FILTER);
    }

    async handleMessage(lists: FiltersEntity, {message, channel, sender, response}: MessageEventArgs): Promise<boolean> {
        if (await message.checkPermission(SpamFilter.IGNORE_FILTER)) return false;
        if (!(await channel.getSetting(SpamFilter.ENABLED))) return false;
        if (!(await this.messageCache.checkSpam(message))) return false;

        await this.strikeManager.issueStrike("spam", message);
        return true;
    }

}