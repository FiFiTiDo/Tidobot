import Container, { Service } from "typedi";
import { EntityRepository, Repository } from "typeorm";
import { Channel } from "../Entities/Channel";
import { Chatter } from "../Entities/Chatter";
import { User } from "../Entities/User";
import EventSystem from "../../Systems/Event/EventSystem";
import Event from "../../Systems/Event/Event";
import { NewChatterEvent } from "../../Chat/Events/NewChatterEvent";
import { isUndefined } from "lodash";
import Optional from "../../Utilities/Patterns/Optional";
import { UserRepository } from "./UserRepository";

@Service()
@EntityRepository(Chatter)
export class ChatterRepository extends Repository<Chatter> {
    private readonly eventSystem: EventSystem;

    constructor(private readonly userRepository: UserRepository) {
        super();

        this.eventSystem = Container.get(EventSystem);
    }

    async findByName(name: string, channel: Channel): Promise<Optional<Chatter>> {
        const user = await this.userRepository.findOne({ name, service: channel.service });
        if (isUndefined(user)) return Optional.empty();
        return this.retreiveOrMake(user, channel).then(chatter => Optional.of(chatter));
    }

    async retreiveOrMake(user: User, channel: Channel): Promise<Chatter> {
        const chatter = await this.findOne({ user, channel });
        if (!isUndefined(chatter)) return chatter;
        
        const newChatter = await this.create({ user, channel }).save();
        const event = new Event(NewChatterEvent);
        event.extra.put(NewChatterEvent.EXTRA_CHATTER, newChatter);
        event.extra.put(NewChatterEvent.EXTRA_CHANNEL, channel);
        this.eventSystem.dispatch(event);
        return newChatter;
    }
}