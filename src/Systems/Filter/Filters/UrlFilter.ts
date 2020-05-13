import Filter from "./Filter";
import {MessageEventArgs} from "../../../Chat/Events/MessageEvent";
import SettingsSystem from "../../Settings/SettingsSystem";
import Setting, {SettingType} from "../../Settings/Setting";
import {array_contains} from "../../../Utilities/ArrayUtils";
import FiltersEntity from "../../../Database/Entities/FiltersEntity";
import StrikeManager from "../StrikeManager";
import PermissionSystem from "../../Permissions/PermissionSystem";
import Permission from "../../Permissions/Permission";
import {Role} from "../../Permissions/Role";

const DOT = /\s?\(dot\)\s?/gi;
const URL_PATTERN = /((http|ftp|https|sftp):\/\/)?(([\w.-]*)\.([\w]*))/igm;

export default class UrlFilter extends Filter {
    constructor(strikeManager: StrikeManager) {
        super(strikeManager);

        const settings = SettingsSystem.getInstance();
        settings.registerSetting(new Setting("filter.urls.whitelist", "true", SettingType.BOOLEAN));

        const perm = PermissionSystem.getInstance();
        perm.registerPermission(new Permission("filter.ignore.url", Role.MODERATOR));
    }

    async handleMessage(lists: FiltersEntity, { message }: MessageEventArgs): Promise<boolean> {
        if (await message.checkPermission("filter.ignore.url")) return false;
        const whitelist = message.getChannel().getSetting<boolean>("filter.urls.whitelist");
        const noDot = message.getRaw().replace(DOT, ".");
        while (true) {
            const res = URL_PATTERN.exec(noDot);
            if (res === null) break;
            const domain = res[3];
            const contains = array_contains(domain, lists.domains);


            if (whitelist ? !contains : contains ) {
                await this.strikeManager.issueStrike("url", message);
                return true;
            }
        }
        return false;
    }
}