import Container, { Service } from "typedi";
import { DeepPartial, EntityRepository, Repository } from "typeorm";
import Event from "../../Systems/Event/Event";
import EventSystem from "../../Systems/Event/EventSystem";
import { User } from "../Entities/User";
import { NewUserEvent } from "../../Chat/Events/NewUserEvent";

@Service()
@EntityRepository(User)
export class UserRepository extends Repository<User> {
    private readonly eventSystem: EventSystem;

    constructor() {
        super();

        this.eventSystem = Container.get(EventSystem);
    }

    async make(entityLike: DeepPartial<User>): Promise<User> {
        const user = await this.create(entityLike).save();

        const event = new Event(NewUserEvent);
        event.extra.put(NewUserEvent.EXTRA_USER, user);
        this.eventSystem.dispatch(event);

        return user;
    }
}