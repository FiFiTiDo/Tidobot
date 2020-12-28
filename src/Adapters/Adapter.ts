import { Channel } from "../Database/Entities/Channel";
import { Service } from "typedi";
import { InjectRepository } from "typeorm-typedi-extensions";
import { Repository } from "typeorm";
import { Service as ServiceEntity } from "../Database/Entities/Service";
import { PG_UNIQUE_CONSTRAINT_VIOLATION } from "../symbols";
import { getLogger, logError } from "../Utilities/Logger";
import { User } from "../Database/Entities/User";
import { ChannelAdapter } from "./ChannelAdapter";
import { UserAdapter } from "./UserAdapter";
import { ChatterRepository } from "../Database/Repositories/ChatterRepository";
import {Chatter} from "../Database/Entities/Chatter";

const logger = getLogger("Adapter");

export type AdapterOptions = {
    identity: string;
    silent: boolean;
    channels: string[];
    [key: string]: any;
}

export interface AdapterConstructor<T extends Adapter> {
    service: T;
    serviceName: string;
    (...args: any[]): T;
}

export default abstract class Adapter {
    public abstract run(options: AdapterOptions): void;

    public abstract stop(): void | Promise<void>;

    public abstract get name(): string;

    public abstract get connectedChannels(): string[];

    public abstract get channelAdapter(): ChannelAdapter<any>;

    public abstract get userAdapter(): UserAdapter<any>;

    public abstract get chatterRepository(): ChatterRepository;

    public abstract async sendMessage(message: string, channel: Channel): Promise<void>;

    public abstract async sendPrivateMessage(message: string, chatter: Chatter): Promise<void>;

    public abstract async sendAction(action: string, channel: Channel): Promise<void>;

    public abstract async unbanChatter(user: User, channel: Channel): Promise<boolean>;

    public abstract async banChatter(user: User, channel: Channel, reason?: string): Promise<boolean>;

    public abstract async tempbanChatter(user: User, channel: Channel, length: number, reason?: string): Promise<boolean>;

    public abstract async broadcastMessage(message: string): Promise<void>;
}

@Service()
export class AdapterManager {
    private adapters: AdapterConstructor<any>[] = [];

    constructor(
        @InjectRepository(ServiceEntity)
        private serviceRepository: Repository<ServiceEntity>
    ) {}

    public async registerAdapter(adapter: AdapterConstructor<any>): Promise<void> {
        this.adapters.push(adapter);

        try {
            await this.serviceRepository.save({ name: adapter.serviceName });
        } catch (e) {
            if (e.code === PG_UNIQUE_CONSTRAINT_VIOLATION) {
                return;
            } else {
                logError(logger, e, "Failed to insert service into database", true);
                process.exit(1);
            }
        }
    }

    public findAdapterByName(name: string): AdapterConstructor<any> {
        return this.adapters.find(adapter => adapter.serviceName === name);
    }
}