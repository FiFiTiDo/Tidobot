import Optional from "../Utilities/Patterns/Optional";
import { Service } from "typedi";
import Config from "../Systems/Config/Config";
import GeneralConfig from "../Systems/Config/ConfigModels/GeneralConfig";
import { Channel } from "../Database/Entities/Channel";
import { InjectRepository } from "typeorm-typedi-extensions";
import { ChannelRepository } from "../Database/Repositories/ChannelRepository";
import { In } from "typeorm";
import { ServiceManager } from "./ServiceManager";
import { MapExt } from "../Utilities/Structures/Map";

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
        config: Config,
        @InjectRepository()
        private readonly repository: ChannelRepository,
        private readonly serviceManager: ServiceManager
    ) {
        config.getConfig(GeneralConfig).then(config => this.channels = config.channels);
        this.channelState = new MapExt();
    }

    getAll(): Promise<Channel[]> {
        return this.repository.find();
    }

    getAllActive(): Promise<Channel[]> {
        return this.repository.find({ name: In(this.channels), service: this.serviceManager.service });
    }

    add(channel: Channel): void {
        this.channels.push(channel.name);
        this.repository.save(channel);
    }

    async findByNativeId(id: string): Promise<Optional<Channel>> {
        const channel = await this.repository.findByNativeId(id, this.serviceManager.service);
        return Optional.ofNullable(channel);
    }

    async findByName(name: string): Promise<Optional<Channel>> {
        const channel = await this.repository.findOne({ name, service: this.serviceManager.service });
        return Optional.ofNullable(channel);
    }

    save(channel: Channel): Promise<any> {
        return this.repository.save(channel);
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