import leven from "leven";
import Message from "../../Chat/Message";
import Setting, {Integer, SettingType} from "../Settings/Setting";
import SettingsSystem from "../Settings/SettingsSystem";
import SpamFilter from "./Filters/SpamFilter";
import { Service } from "typedi";
import { Channel } from "../../Database/Entities/Channel";
import { EntityStateList } from "../../Database/EntityStateLiist";

@Service()
export default class MessageCache {
    private static MAX_CACHE = new Setting("filter.cache.amount", 30 as Integer, SettingType.INTEGER);

    private messages: EntityStateList<Channel, Message[]> = new EntityStateList<Channel, Message[]>([]);

    constructor(settings: SettingsSystem) {
        settings.registerSetting(MessageCache.MAX_CACHE);
    }

    add(message: Message): void {
        const channel = message.getChannel();
        const messages = this.messages.get(channel);
        const maxMessages = channel.settings.get(MessageCache.MAX_CACHE);
        messages.push(message);
        messages.slice(Math.max(0, messages.length - maxMessages), Math.min(messages.length, maxMessages));
        this.messages.set(channel, messages);
    }

    getAll(channel: Channel): Message[] {
        return this.messages.get(channel);
    }

    async checkSpam(message: Message): Promise<boolean> {
        const channel = message.getChannel();
        const messageRaw = message.getRaw();
        let matches = 0;
        const messages = this.messages.get(channel);
        const maxPercentage = channel.settings.get(SpamFilter.SIMILARITY);
        for (const cached of messages) {
            const cachedRaw = cached.getRaw();
            const distance = leven(messageRaw, cachedRaw);
            const bigger = Math.max(messageRaw.length, cachedRaw.length);
            const percentage = ((1 - distance) / bigger) * 100;
            if (percentage >= maxPercentage) matches++;
        }
        return matches >= channel.settings.get(SpamFilter.AMOUNT);
    }

    purge(): void {
        this.messages.clear();
    }
}