import { Inject, Service } from "typedi";
import { InjectRepository } from "typeorm-typedi-extensions";
import { Service as ServiceEntity } from "../Database/Entities/Service";
import { Channel } from "../Database/Entities/Channel";
import Optional from "../Utilities/Patterns/Optional";
import { ServiceToken } from "../symbols";
import { ChannelRepository } from "../Database/Repositories/ChannelRepository";

@Service()
export abstract class ChannelAdapter<ParamT> {
    @InjectRepository() private repository: ChannelRepository;
    @Inject(ServiceToken) private service: ServiceEntity;

    abstract async getChannel(param: ParamT): Promise<Channel>;

    protected async findById(nativeId: string): Promise<Optional<Channel>> {
        return this.repository.findOne({ nativeId, service: this.service }).then(user => Optional.ofUndefable(user));
    }

    protected async findByName(name: string): Promise<Optional<Channel>> {
        return this.repository.findOne({ name, service: this.service }).then(user => Optional.ofUndefable(user));
    }

    protected async createChannel(name: string, nativeId: string): Promise<Channel> {
        return this.repository.make({ name, nativeId, service: this.service });
    }
}