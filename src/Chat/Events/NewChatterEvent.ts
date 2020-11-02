import Event, {EventArguments} from "../../Systems/Event/Event";
import { Chatter } from "../../Database/Entities/Chatter";

export class NewChatterEvent extends Event<NewChatterEvent> {
    public static readonly NAME = "chatter:new";

    constructor(public readonly chatter: Chatter) {
        super(NewChatterEvent);
    }

    getEventArgs(): NewChatterEventArgs {
        return Object.assign(super.getEventArgs(), {
            chatter: this.chatter
        });
    }
}

export interface NewChatterEventArgs extends EventArguments<NewChatterEvent> {
    chatter: Chatter;
}