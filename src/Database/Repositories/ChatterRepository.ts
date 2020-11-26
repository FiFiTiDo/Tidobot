import { Service } from "typedi";
import { EntityRepository, Repository } from "typeorm";
import { Channel } from "../Entities/Channel";
import { Chatter } from "../Entities/Chatter";
import { User } from "../Entities/User";
import EventSystem from "../../Systems/Event/EventSystem";
import Event from "../../Systems/Event/Event";
import { NewChatterEvent } from "../../Chat/Events/NewChatterEvent";

@Service()
@EntityRepository(Chatter)
export class ChatterRepository extends Repository<Chatter> {
    constructor(private readonly eventSystem: EventSystem) {
        super();
    }

    async retreiveOrMake(user: User, channel: Channel): Promise<Chatter> {
        const chatter = this.findOne({ user, channel });
        if (chatter) return chatter;

        const newChatter = await this.create({ user, channel }).save();
        const event = new Event(NewChatterEvent);
        event.extra.put(NewChatterEvent.EXTRA_CHATTER, newChatter);
        this.eventSystem.dispatch(event);
        return newChatter;
    }
}