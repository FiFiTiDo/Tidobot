import { Service } from "typedi";
import { EntityRepository, Repository } from "typeorm";
import { InjectRepository } from "typeorm-typedi-extensions";
import { ServiceManager } from "../../Chat/ServiceManager";
import { Channel } from "../Entities/Channel";
import { Chatter } from "../Entities/Chatter";
import { User } from "../Entities/User";

@Service()
@EntityRepository(Chatter)
export class ChatterRepository extends Repository<Chatter> {
    constructor(
        @InjectRepository()
        private readonly userRepository: Repository<User>,
        private readonly serviceManager: ServiceManager
    ) {
        super();
    }

    async make(nativeId: string, name: string, channel: Channel): Promise<Chatter> {
        const user = new User();
        user.nativeId = nativeId;
        user.name = name;
        user.service = this.serviceManager.service;
        await this.userRepository.save(user);
        await user.reload();

        const chatter = new Chatter();
        chatter.user = user;
        chatter.channel = channel;
        this.save(chatter);
        await chatter.reload();
        return chatter;
    }
}