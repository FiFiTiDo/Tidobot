import ChannelEntity from "../../Database/Entities/ChannelEntity";
import leven from "leven";
import Message from "../../Chat/Message";
import Setting, {Integer, SettingType} from "../Settings/Setting";
import SettingsSystem from "../Settings/SettingsSystem";
import EntityStateList from "../../Database/EntityStateList";

export default class MessageCache {
    private messages: EntityStateList<ChannelEntity, Message[]> = new EntityStateList<ChannelEntity, Message[]>([]);

    constructor() {
        const settings = SettingsSystem.getInstance();
        settings.registerSetting(new Setting("filter.cache.amount", 30 as Integer, SettingType.INTEGER));
    }

    async add(message: Message): Promise<void> {
        const channel = message.getChannel();
        const messages = this.messages.get(channel);
        messages.push(message);
        const maxMessages = await this.getMaxMessages(channel);
        while (messages.length > maxMessages)
            messages.unshift();
        this.messages.set(channel, messages);
    }

    async getMaxPercentage(channel: ChannelEntity): Promise<number> {
        return channel.getSetting<SettingType.INTEGER>("filter.spam.similarity");
    }

    async getMaxMessages(channel: ChannelEntity): Promise<number> {
        return channel.getSetting<SettingType.INTEGER>("filter.cache.amount");
    }

    async getMaxMatches(channel: ChannelEntity): Promise<number> {
        return channel.getSetting<SettingType.INTEGER>("filter.spam.amount");
    }

    getAll(channel: ChannelEntity): Message[] {
        return this.messages.get(channel);
    }

    async checkSpam(message: Message): Promise<boolean> {
        const channel = message.getChannel();
        const messageRaw = message.getRaw();
        let matches = 0;
        const messages = this.messages.get(channel);
        const maxPercentage = await this.getMaxPercentage(channel);
        for (const cached of messages) {
            const cachedRaw = cached.getRaw();
            const distance = leven(messageRaw, cachedRaw);
            const bigger = Math.max(messageRaw.length, cachedRaw.length);
            const percentage = ((1 - distance) / bigger) * 100;
            if (percentage >= maxPercentage) matches++;
        }
        return matches < await this.getMaxMatches(channel);
    }

    purge(): void {
        this.messages.clear()
    }
}