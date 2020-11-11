import Container, { Service } from "typedi";
import { EntityRepository, Repository } from "typeorm";
import { InjectRepository } from "typeorm-typedi-extensions";
import { Channel } from "../Entities/Channel";
import { Chatter } from "../Entities/Chatter";
import { User } from "../Entities/User";
import { ServiceToken } from "../../symbols";

@Service()
@EntityRepository(Chatter)
export class ChatterRepository extends Repository<Chatter> {
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>
    ) {
        super();
    }

    async make(nativeId: string, name: string, channel: Channel): Promise<Chatter> {
        let user = new User();
        user.nativeId = nativeId;
        user.name = name;
        user.service = Container.get(ServiceToken);
        user = await this.userRepository.save(user);

        const chatter = new Chatter();
        chatter.user = user;
        chatter.channel = channel;
        return this.save(chatter);
    }
}