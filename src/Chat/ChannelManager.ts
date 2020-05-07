import ChannelEntity from "../Database/Entities/ChannelEntity";

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
}