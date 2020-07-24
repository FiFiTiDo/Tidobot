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
import {URL_PATTERN} from "../../../Utilities/Regex/Url";

const FAKE_DOT = /\s?(?:\(dot\))\s?/gi;
const SPACE_DOT = /.+\s+\.\s+.+/gi;

export default class UrlFilter extends Filter {
    private static ENABLED = new Setting("filter.urls.enabled", true, SettingType.BOOLEAN);
    private static BLOCK_LIST = new Setting("filter.urls.block-list", true, SettingType.BOOLEAN);
    private static FAKE_DOT = new Setting("filter.urls.fake-dot", true, SettingType.BOOLEAN);
    private static SPACE_DOT = new Setting("filter.urls.space-dot", true, SettingType.BOOLEAN);

    private static IGNORE_FILTER = new Permission("filter.ignore.url", Role.MODERATOR);

    constructor(strikeManager: StrikeManager) {
        super(strikeManager);

        const settings = SettingsSystem.getInstance();
        settings.registerSetting(UrlFilter.ENABLED);
        settings.registerSetting(UrlFilter.BLOCK_LIST);
        settings.registerSetting(UrlFilter.FAKE_DOT);
        settings.registerSetting(UrlFilter.SPACE_DOT);

        const perm = PermissionSystem.getInstance();
        perm.registerPermission(UrlFilter.IGNORE_FILTER);
    }

    async handleMessage(lists: FiltersEntity, {message, channel}: MessageEventArgs): Promise<boolean> {
        if (await message.checkPermission(UrlFilter.IGNORE_FILTER)) return false;
        if (!(await channel.getSetting(UrlFilter.ENABLED))) return false;
        const blockList = await message.getChannel().getSetting(UrlFilter.BLOCK_LIST);

        if (await channel.getSetting(UrlFilter.FAKE_DOT) && message.getRaw().match(FAKE_DOT) !== null)
            await this.strikeManager.issueStrike("fake-dot", message);
        if (await channel.getSetting(UrlFilter.SPACE_DOT) && message.getRaw().match(SPACE_DOT) !== null)
            await this.strikeManager.issueStrike("fake-dot", message);

        const strike = message.getParts()
            .filter(part => part.match(URL_PATTERN) !== null)
            .map(urlStr => new URL(urlStr))
            .some(url => {
                const contains = arrayContains(url.host, lists.domains);
                return blockList ? contains : !contains;
            });
        if (strike) await this.strikeManager.issueStrike("url", message);
        return strike;
    }
}