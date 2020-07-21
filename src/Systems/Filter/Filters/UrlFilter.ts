import Filter from "./Filter";
import {MessageEventArgs} from "../../../Chat/Events/MessageEvent";
import SettingsSystem from "../../Settings/SettingsSystem";
import Setting, {SettingType} from "../../Settings/Setting";
import {arrayContains} from "../../../Utilities/ArrayUtils";
import FiltersEntity from "../../../Database/Entities/FiltersEntity";
import StrikeManager from "../StrikeManager";
import PermissionSystem from "../../Permissions/PermissionSystem";
import Permission from "../../Permissions/Permission";
import {Role} from "../../Permissions/Role";

const DOT = /\s?\(dot\)\s?/gi;
const URL_PATTERN = /((?:(http|https|Http|Https|rtsp|Rtsp):\/\/(?:(?:[a-zA-Z0-9\$\-\_\.\+\!\*\'\(\)\,\;\?\&\=]|(?:\%[a-fA-F0-9]{2})){1,64}(?:\:(?:[a-zA-Z0-9\$\-\_\.\+\!\*\'\(\)\,\;\?\&\=]|(?:\%[a-fA-F0-9]{2})){1,25})?\@)?)?((?:(?:[a-zA-Z0-9][a-zA-Z0-9\-]{0,64}\.)+(?:(?:aero|arpa|asia|a[cdefgilmnoqrstuwxz])|(?:biz|b[abdefghijmnorstvwyz])|(?:cat|com|coop|c[acdfghiklmnoruvxyz])|d[ejkmoz]|(?:edu|e[cegrstu])|f[ijkmor]|(?:gov|g[abdefghilmnpqrstuwy])|h[kmnrtu]|(?:info|int|i[delmnoqrst])|(?:jobs|j[emop])|k[eghimnrwyz]|l[abcikrstuvy]|(?:mil|mobi|museum|m[acdghklmnopqrstuvwxyz])|(?:name|net|n[acefgilopruz])|(?:org|om)|(?:pro|p[aefghklmnrstwy])|qa|r[eouw]|s[abcdeghijklmnortuvyz]|(?:tel|travel|t[cdfghjklmnoprtvwz])|u[agkmsyz]|v[aceginu]|w[fs]|y[etu]|z[amw]))|(?:(?:25[0-5]|2[0-4][0-9]|[0-1][0-9]{2}|[1-9][0-9]|[1-9])\.(?:25[0-5]|2[0-4][0-9]|[0-1][0-9]{2}|[1-9][0-9]|[1-9]|0)\.(?:25[0-5]|2[0-4][0-9]|[0-1][0-9]{2}|[1-9][0-9]|[1-9]|0)\.(?:25[0-5]|2[0-4][0-9]|[0-1][0-9]{2}|[1-9][0-9]|[0-9])))(?:\:\d{1,5})?)(\/(?:(?:[a-zA-Z0-9\;\/\?\:\@\&\=\#\~\-\.\+\!\*\'\(\)\,\_])|(?:\%[a-fA-F0-9]{2}))*)?(?:\b|$)/gi;

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
            const url = new URL(res[0]);
            const contains = arrayContains(url.host, lists.domains);


            if (whitelist ? !contains : contains ) {
                await this.strikeManager.issueStrike("url", message);
                return true;
            }
        }
        return false;
    }
}