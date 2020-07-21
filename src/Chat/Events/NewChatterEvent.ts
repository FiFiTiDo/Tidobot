import Event, {EventArguments} from "../../Systems/Event/Event";
import ChatterEntity from "../../Database/Entities/ChatterEntity";

export class NewChatterEvent extends Event<NewChatterEvent> {
    public static readonly NAME = "chatter:new";

    constructor(private readonly chatter: ChatterEntity) {
        super(NewChatterEvent);
    }

    getEventArgs(): NewChatterEventArgs {
        return Object.assign(super.getEventArgs(), {
            chatter: this.chatter
        });
    }
}

export interface NewChatterEventArgs extends EventArguments<NewChatterEvent> {
    chatter: ChatterEntity
}