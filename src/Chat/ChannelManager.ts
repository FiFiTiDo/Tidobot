import ChannelEntity from "../Database/Entities/ChannelEntity";
import {provide} from "inversify-binding-decorators";
import {MapExt} from "../Utilities/Structures/Map";
import Optional from "../Utilities/Patterns/Optional";

@provide(ChannelManager)
export default class ChannelManager {
    private readonly channels: MapExt<string, ChannelEntity>;

    constructor() {
        this.channels = new MapExt();
    }

    getAll(): ChannelEntity[] {
        return [...this.channels.values()];
    }

    add(channel: ChannelEntity): void {
        this.channels.setNew(channel.channelId, channel);
    }

    findByName(name: string): Optional<ChannelEntity> {
        return Optional.ofUndefable(this.getAll().filter(channel => channel.name === name)[0]);
    }
}