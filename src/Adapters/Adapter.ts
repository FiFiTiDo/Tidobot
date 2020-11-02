import TickEvent from "../Application/TickEvent";
import EventSystem from "../Systems/Event/EventSystem";
import TimerSystem, {TimeUnit} from "../Systems/Timer/TimerSystem";
import { Channel } from "../Database/Entities/Channel";
import { Chatter } from "../Database/Entities/Chatter";
import Container, { Service } from "typedi";
import { InjectRepository } from "typeorm-typedi-extensions";
import { Repository } from "typeorm";
import { Service as ServiceEntity } from "../Database/Entities/Service";

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

    public abstract getName(): string;

    public abstract async sendMessage(message: string, channel: Channel): Promise<void>;

    public abstract async sendAction(action: string, channel: Channel): Promise<void>;

    public abstract async unbanChatter(chatter: Chatter): Promise<boolean>;

    public abstract async banChatter(chatter: Chatter, reason?: string): Promise<boolean>;

    public abstract async tempbanChatter(chatter: Chatter, length: number, reason?: string): Promise<boolean>;
}

@Service()
export class AdapterManager {
    private adapters: AdapterConstructor<any>[];

    constructor(
        @InjectRepository()
        private serviceRepository: Repository<ServiceEntity>
    ) {

    }

    public async registerAdapter(adapter: AdapterConstructor<any>): Promise<void> {
        this.adapters.push(adapter);

        await this.serviceRepository.save({ name: adapter.serviceName });
    }

    public findAdapterByName(name: string): AdapterConstructor<any> {
        return this.adapters.find(adapter => adapter.serviceName === name);
    }
}