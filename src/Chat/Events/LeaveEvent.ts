import Event from "../../Systems/Event/Event";
import ChatterEntity from "../../Database/Entities/ChatterEntity";
import ChannelEntity from "../../Database/Entities/ChannelEntity";

export default class LeaveEvent extends Event<LeaveEvent> {
    public static readonly NAME = "chat_leave";

    constructor(private readonly chatter: ChatterEntity, private readonly channel: ChannelEntity) {
        super(LeaveEvent);
    }

    getChatter(): ChatterEntity {
        return this.chatter;
    }

    getChannel(): ChannelEntity {
        return this.channel;
    }
}