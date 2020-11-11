import { Channel } from "../Database/Entities/Channel";
import { Chatter } from "../Database/Entities/Chatter";
import { Service } from "typedi";
import { InjectRepository } from "typeorm-typedi-extensions";
import { Repository } from "typeorm";
import { Service as ServiceEntity } from "../Database/Entities/Service";
import { PG_UNIQUE_CONSTRAINT_VIOLATION } from "../symbols";
import { getLogger, logError } from "../Utilities/Logger";

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

    public abstract async sendMessage(message: string, channel: Channel): Promise<void>;

    public abstract async sendAction(action: string, channel: Channel): Promise<void>;

    public abstract async unbanChatter(chatter: Chatter): Promise<boolean>;

    public abstract async banChatter(chatter: Chatter, reason?: string): Promise<boolean>;

    public abstract async tempbanChatter(chatter: Chatter, length: number, reason?: string): Promise<boolean>;
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