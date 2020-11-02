import Event, {EventArguments} from "../../Systems/Event/Event";
import { Channel } from "../../Database/Entities/Channel";

export class NewChannelEvent extends Event<NewChannelEvent> {
    public static readonly NAME = "channel:new";

    constructor(private readonly channel: Channel) {
        super(NewChannelEvent);
    }

    getEventArgs(): NewChannelEventArgs {
        return Object.assign(super.getEventArgs(), {
            channel: this.channel
        });
    }
}

export interface NewChannelEventArgs extends EventArguments<NewChannelEvent> {
    channel: Channel;
}