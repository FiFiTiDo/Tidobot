import { Inject, Service } from "typedi";
import { InjectRepository } from "typeorm-typedi-extensions";
import { User } from "../Database/Entities/User";
import { Service as ServiceEntity } from "../Database/Entities/Service";
import { ServiceToken } from "../symbols";
import Optional from "../Utilities/Patterns/Optional";
import { UserRepository } from "../Database/Repositories/UserRepository";

@Service()
export abstract class UserAdapter<ParamT> {
    @InjectRepository() private repository: UserRepository;
    @Inject(ServiceToken) private service: ServiceEntity;

    abstract async getUser(param: ParamT): Promise<User>;

    abstract async getUserByNativeId(nativeId: string): Promise<User>;

    abstract async getUserByName(name: string): Promise<User>;

    protected async findById(nativeId: string): Promise<Optional<User>> {
        return this.repository.findOne({ nativeId, service: this.service }).then(user => Optional.ofUndefable(user));
    }

    protected async findByName(name: string): Promise<Optional<User>> {
        return this.repository.findOne({ name, service: this.service }).then(user => Optional.ofUndefable(user));
    }

    protected async createUser(name: string, nativeId: string): Promise<User> {
        return this.repository.make({ name, nativeId, service: this.service });
    }

    public async getOrCreateUser(name: string, nativeId: string): Promise<User> {
        const optional = await this.findById(nativeId);
        return await optional.orElseAsync(() => this.createUser(name, nativeId));
    }
}