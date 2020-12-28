import { Inject, Service } from "typedi";
import { Channel } from "../Database/Entities/Channel";
import { InjectRepository } from "typeorm-typedi-extensions";
import { Service as ServiceEntity } from "../Database/Entities/Service";
import { ChannelRepository } from "../Database/Repositories/ChannelRepository";
import { In } from "typeorm";
import { MapExt } from "../Utilities/Structures/Map";
import { ServiceToken } from "../symbols";
import EventSystem from "../Systems/Event/EventSystem";
import {StartStreamEvent} from "../Companion/Events/StartStreamEvent";
import {StopStreamEvent} from "../Companion/Events/StopStreamEvent";

interface ChannelState {
    id: number;
    nativeId: string;
    name: string;
    online: boolean;
}

@Service()
export default class ChannelManager {
    private channels: string[] = [];
    private channelState: MapExt<string, ChannelState>;

    constructor(
        @InjectRepository() private readonly repository: ChannelRepository,
        @Inject(ServiceToken) private readonly service: ServiceEntity,
        eventSystem: EventSystem
    ) {
        this.channelState = new MapExt();

        eventSystem.addListener(StartStreamEvent, event => {
            this.setOnline(event.extra.get(StartStreamEvent.EXTRA_CHANNEL), true)
        });

        eventSystem.addListener(StopStreamEvent, event => {
            this.setOnline(event.extra.get(StartStreamEvent.EXTRA_CHANNEL), false)
        });
    }

    setActive(channels: string[]): void {
        this.channels = channels;
    }

    getAllActive(): Promise<Channel[]> {
        return this.repository.find({ name: In(this.channels), service: this.service });
    }

    getState(channel: Channel): ChannelState {
        return this.channelState.getOrSet(channel.name, {
            id: channel.id,
            nativeId: channel.nativeId,
            name: channel.name,
            online: false
        });
    }

    isOnline(channel: Channel): boolean {
        return this.getState(channel).online;
    }

    setOnline(channel: Channel, online: boolean): void {
        this.getState(channel).online = online;
    }
}