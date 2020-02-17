import Channel from "./Channel";
import Application from "../Application/Application";

export default class ChannelManager {
    private readonly channels: Channel[];
    private readonly ids: string[];

    constructor() {
        this.channels = [];
        this.ids = [];
    }

    findChannelById(id: string) {
        for (let channel of this.channels)
            if (channel.getId() === id)
                return channel;
        return null;
    }

    getAll() {
        return this.channels;
    }

    add(channel: Channel) {
        if (this.ids.indexOf(channel.getId()) >= 0) return;

        this.ids.push(channel.getId());
        this.channels.push(channel);
    }

    broadcast(message: string) {
        let ops = [];
        for (let channel of this.channels)
            ops.push(Application.getAdapter().sendMessage(message, channel));
        return Promise.all(ops);
    }
}