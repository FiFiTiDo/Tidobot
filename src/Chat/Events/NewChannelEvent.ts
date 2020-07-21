import Event, {EventArguments} from "../../Systems/Event/Event";
import ChannelEntity from "../../Database/Entities/ChannelEntity";

export class NewChannelEvent extends Event<NewChannelEvent> {
    public static readonly NAME = "channel:new";

    constructor(private readonly channel: ChannelEntity) {
        super(NewChannelEvent);
    }

    getEventArgs(): NewChannelEventArgs {
        return Object.assign(super.getEventArgs(), {
            channel: this.channel
        });
    }
}

export interface NewChannelEventArgs extends EventArguments<NewChannelEvent> {
    channel: ChannelEntity
}