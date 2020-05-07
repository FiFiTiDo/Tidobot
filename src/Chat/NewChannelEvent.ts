import Event, {EventArguments} from "../Systems/Event/Event";
import ChannelEntity from "../Database/Entities/ChannelEntity";

export class NewChannelEvent extends Event<NewChannelEvent> {
    public static readonly NAME = "channel:new";

    constructor(private readonly channel: ChannelEntity) {
        super(NewChannelEvent.NAME);
    }

    getEventArgs(): NewChannelEvent.Arguments {
        return Object.assign(super.getEventArgs(), {
            channel: this.channel
        });
    }
}

export namespace NewChannelEvent {
    export interface Arguments extends EventArguments<NewChannelEvent> {
        channel: ChannelEntity
    }
}