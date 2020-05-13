import Filter from "./Filter";
import FiltersEntity from "../../../Database/Entities/FiltersEntity";
import {MessageEventArgs} from "../../../Chat/Events/MessageEvent";
import SettingsSystem from "../../Settings/SettingsSystem";
import Setting, {SettingType} from "../../Settings/Setting";
import ChannelEntity, {ChannelStateList} from "../../../Database/Entities/ChannelEntity";
import leven from "leven";
import StrikeManager from "../StrikeManager";
import PermissionSystem from "../../Permissions/PermissionSystem";
import Permission from "../../Permissions/Permission";
import {Role} from "../../Permissions/Role";

class MessageCache {
    private messages: ChannelStateList<string[]> = new ChannelStateList<string[]>([]);

    constructor() {
    }

    async add(message: string, channel: ChannelEntity): Promise<void> {
        const messages = this.messages.getChannel(channel);
        messages.push(message);
        const maxMessages = await this.getMaxMessages(channel);
        while (messages.length > maxMessages)
            messages.unshift();
        this.messages.setChannel(channel, messages);
    }

    async getMaxPercentage(channel: ChannelEntity): Promise<number> {
        return channel.getSetting<number>("filter.spam.similarity");
    }

    async getMaxMessages(channel: ChannelEntity): Promise<number> {
        return channel.getSetting<number>("filter.spam.cache");
    }

    async getMaxMatches(channel: ChannelEntity): Promise<number> {
        return channel.getSetting<number>("filter.spam.amount");
    }

    async check(message: string, channel: ChannelEntity): Promise<boolean> {
        let matches = 0;
        const messages = this.messages.getChannel(channel);
        const maxPercentage = await this.getMaxPercentage(channel);
        for (const cached of messages) {
            const distance = leven(message, cached);
            const bigger = Math.max(message.length, cached.length);
            const percentage = ((1 - distance) / bigger) * 100;
            if (percentage >= maxPercentage) matches++;
        }
        return matches < await this.getMaxMatches(channel);
    }

    purge(): void {
        this.messages.clear()
    }
}

export default class SpamFilter extends Filter {
    private messageCache: MessageCache = new MessageCache();

    constructor(strikeManager: StrikeManager) {
        super(strikeManager);

        const settings = SettingsSystem.getInstance();
        settings.registerSetting(new Setting("filter.spam.enabled", "true", SettingType.BOOLEAN));
        settings.registerSetting(new Setting("filter.spam.amount", "15", SettingType.INTEGER));
        settings.registerSetting(new Setting("filter.spam.cache", "30", SettingType.INTEGER));
        settings.registerSetting(new Setting("filter.spam.similarity", "90", SettingType.INTEGER));

        const perm = PermissionSystem.getInstance();
        perm.registerPermission(new Permission("filter.ignore.spam", Role.MODERATOR));
    }

    async handleMessage(lists: FiltersEntity, { message, channel, sender, response }: MessageEventArgs): Promise<boolean> {
        if (await message.checkPermission("filter.ignore.spam")) return false;
        const enabled = channel.getSetting<boolean>("filter.spam.enabled");
        if (!enabled) return false;

        if (!(await this.messageCache.check(message.getRaw(), channel))) {
            await this.strikeManager.issueStrike("spam", message);
            return true;
        }

        return false;
    }

}