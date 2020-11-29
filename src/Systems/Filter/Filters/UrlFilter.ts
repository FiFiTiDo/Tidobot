import Filter from "./Filter";
import SettingsSystem from "../../Settings/SettingsSystem";
import Setting, {SettingType} from "../../Settings/Setting";
import PermissionSystem from "../../Permissions/PermissionSystem";
import Permission from "../../Permissions/Permission";
import {Role} from "../../Permissions/Role";
import {URL_PATTERN} from "../../../Utilities/Regex/Url";
import { Service } from "typedi";
import Message from "../../../Chat/Message";

const FAKE_DOT = /\s?(?:\(dot\))\s?/gi;
const SPACE_DOT = /.+\s+\.\s+.+/gi;

@Service()
export default class UrlFilter extends Filter {
    private static ENABLED = new Setting("filter.urls.enabled", true, SettingType.BOOLEAN);
    private static BLOCK_LIST = new Setting("filter.urls.block-list", true, SettingType.BOOLEAN);
    private static FAKE_DOT = new Setting("filter.urls.fake-dot", true, SettingType.BOOLEAN);
    private static SPACE_DOT = new Setting("filter.urls.space-dot", true, SettingType.BOOLEAN);

    private static IGNORE_FILTER = new Permission("filter.ignore.url", Role.MODERATOR);

    constructor(settings: SettingsSystem, perm: PermissionSystem) {
        super();

        settings.registerSetting(UrlFilter.ENABLED);
        settings.registerSetting(UrlFilter.BLOCK_LIST);
        settings.registerSetting(UrlFilter.FAKE_DOT);
        settings.registerSetting(UrlFilter.SPACE_DOT);
        perm.registerPermission(UrlFilter.IGNORE_FILTER);
    }

    async handleMessage(message: Message): Promise<boolean> {
        const channel = message.channel;
        if (await message.checkPermission(UrlFilter.IGNORE_FILTER)) return false;
        if (!channel.settings.get(UrlFilter.ENABLED)) return false;
        const blockList = channel.settings.get(UrlFilter.BLOCK_LIST);

        if (channel.settings.get(UrlFilter.FAKE_DOT) && message.getRaw().match(FAKE_DOT) !== null)
            await this.strikeManager.issueStrike("fake-dot", message);
        if (channel.settings.get(UrlFilter.SPACE_DOT) && message.getRaw().match(SPACE_DOT) !== null)
            await this.strikeManager.issueStrike("fake-dot", message);

        const strike = message.getParts()
            .filter(part => part.match(URL_PATTERN) !== null)
            .map(urlStr => new URL(urlStr))
            .some(url => {
                let contains = false;
                for(const filter of channel.domainFilters) {
                    if (url.host.toLowerCase() === filter.value.toLowerCase()) {
                        contains = true;
                        break;
                    }
                }
                return blockList ? contains : !contains;
            });
        if (strike) await this.strikeManager.issueStrike("url", message);
        return strike;
    }
}