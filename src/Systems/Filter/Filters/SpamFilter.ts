import Filter from "./Filter";
import FiltersEntity from "../../../Database/Entities/FiltersEntity";
import {MessageEventArgs} from "../../../Chat/Events/MessageEvent";
import SettingsSystem from "../../Settings/SettingsSystem";
import Setting, {SettingType} from "../../Settings/Setting";
import StrikeManager from "../StrikeManager";
import PermissionSystem from "../../Permissions/PermissionSystem";
import Permission from "../../Permissions/Permission";
import {Role} from "../../Permissions/Role";
import MessageCache from "../MessageCache";



export default class SpamFilter extends Filter {
    constructor(strikeManager: StrikeManager, private messageCache: MessageCache) {
        super(strikeManager);

        const settings = SettingsSystem.getInstance();
        settings.registerSetting(new Setting("filter.spam.enabled", "true", SettingType.BOOLEAN));
        settings.registerSetting(new Setting("filter.spam.amount", "15", SettingType.INTEGER));
        settings.registerSetting(new Setting("filter.spam.similarity", "90", SettingType.INTEGER));

        const perm = PermissionSystem.getInstance();
        perm.registerPermission(new Permission("filter.ignore.spam", Role.MODERATOR));
    }

    async handleMessage(lists: FiltersEntity, { message, channel, sender, response }: MessageEventArgs): Promise<boolean> {
        if (await message.checkPermission("filter.ignore.spam")) return false;
        const enabled = channel.getSetting<boolean>("filter.spam.enabled");
        if (!enabled) return false;

        if (!(await this.messageCache.checkSpam(message))) {
            await this.strikeManager.issueStrike("spam", message);
            return true;
        }

        return false;
    }

}