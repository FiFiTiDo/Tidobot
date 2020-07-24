import Filter from "./Filter";
import FiltersEntity from "../../../Database/Entities/FiltersEntity";
import {MessageEventArgs} from "../../../Chat/Events/MessageEvent";
import StrikeManager from "../StrikeManager";
import SettingsSystem from "../../Settings/SettingsSystem";
import Setting, {Integer, SettingType} from "../../Settings/Setting";
import {TwitchMessage} from "../../../Adapters/Twitch/TwitchMessage";
import PermissionSystem from "../../Permissions/PermissionSystem";
import Permission from "../../Permissions/Permission";
import {Role} from "../../Permissions/Role";

export default class EmoteFilter extends Filter {
    private static ENABLED = new Setting("filter.emotes.enabled", true, SettingType.BOOLEAN);
    private static BLOCK_LIST = new Setting("filter.emotes.block-list", true, SettingType.BOOLEAN);
    private static AMOUNT = new Setting("filter.emotes.amount", 20 as Integer, SettingType.INTEGER);

    private static IGNORE_FILTER = new Permission("filter.ignore.emote", Role.MODERATOR);

    constructor(strikeManager: StrikeManager) {
        super(strikeManager);

        const settings = SettingsSystem.getInstance();
        settings.registerSetting(EmoteFilter.ENABLED);
        settings.registerSetting(EmoteFilter.BLOCK_LIST);
        settings.registerSetting(EmoteFilter.AMOUNT);

        const perm = PermissionSystem.getInstance();
        perm.registerPermission(EmoteFilter.IGNORE_FILTER);
    }

    async handleMessage(lists: FiltersEntity, {message, channel, sender, response}: MessageEventArgs): Promise<boolean> {
        if (await message.checkPermission(EmoteFilter.IGNORE_FILTER)) return false;
        if (!(await channel.getSetting(EmoteFilter.ENABLED))) return false;

        const emotes = lists.emotes;
        const blockList = await channel.getSetting(EmoteFilter.BLOCK_LIST);
        const max = await channel.getSetting(EmoteFilter.AMOUNT);

        if (message instanceof TwitchMessage) {
            const msgEmotes = message.getUserState().emotes || {};
            for (const emote of Object.keys(msgEmotes)) {
                const emoteInList = emotes.indexOf(emote) >= 0;
                if (blockList ? emoteInList : !emoteInList) {
                    await this.strikeManager.issueStrike("emotes.blacklisted", message);
                }
            }

            const amount = Object.values(msgEmotes).reduce((previous, next) => previous + next.length, 0);
            if (amount >= max) {
                await this.strikeManager.issueStrike("emotes.too-many", message);
                return;
            }
        }


        return false;
    }

}