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
    constructor(strikeManager: StrikeManager) {
        super(strikeManager);

        const settings = SettingsSystem.getInstance();
        settings.registerSetting(new Setting("filter.emotes.enabled", true, SettingType.BOOLEAN));
        settings.registerSetting(new Setting("filter.emotes.whitelist", false, SettingType.BOOLEAN));
        settings.registerSetting(new Setting("filter.emotes.amount", 20 as Integer, SettingType.INTEGER));

        const perm = PermissionSystem.getInstance();
        perm.registerPermission(new Permission("filter.ignore.emote", Role.MODERATOR));
    }

    async handleMessage(lists: FiltersEntity, {message, channel, sender, response}: MessageEventArgs): Promise<boolean> {
        if (await message.checkPermission("filter.ignore.emote")) return false;
        const enabled = await channel.getSetting("filter.emotes.enabled");
        if (!enabled) return false;

        const emotes = lists.emotes;
        const whitelist = await channel.getSetting<SettingType.BOOLEAN>("filter.emotes.whitelist");
        const max = await channel.getSetting<SettingType.INTEGER>("filter.emotes.amount");

        if (message instanceof TwitchMessage) {
            const msgEmotes = message.getUserState().emotes || {};
            for (const emote of Object.keys(msgEmotes)) {
                const emoteInList = emotes.indexOf(emote) >= 0;
                if (whitelist ? !emoteInList : emoteInList) {
                    await this.strikeManager.issueStrike("emotes.blacklisted", message);
                }
            }

            const amount = Object.values(msgEmotes).reduce<number>((previous, next) => {
                return previous + next.length;
            }, 0);
            if (amount >= max) {
                await this.strikeManager.issueStrike("emotes.too-many", message);
                return;
            }
        }


        return false;
    }

}