import ChannelEntity from "../Database/Entities/ChannelEntity";
import {provide} from "inversify-binding-decorators";

@provide(ChannelManager)
export default class ChannelManager {
    private readonly channels: ChannelEntity[];
    private readonly ids: string[];

    constructor() {
        this.channels = [];
        this.ids = [];
    }

    getAll(): ChannelEntity[] {
        return this.channels;
    }

    add(channel: ChannelEntity): void {
        if (this.ids.indexOf(channel.channelId) >= 0) return;
        this.ids.push(channel.channelId);
        this.channels.push(channel);
    }

    findByName(name: string): ChannelEntity | null {
        for (const channel of this.channels)
            if (channel.name === name)
                return channel;
        return null;
    }
}