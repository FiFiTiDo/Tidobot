import Event from "../../Systems/Event/Event";
import { Chatter } from "../../Database/Entities/Chatter";
import { Channel } from "../../Database/Entities/Channel";

export default class LeaveEvent extends Event<LeaveEvent> {
    public static readonly NAME = "chat_leave";

    constructor(public readonly chatter: Chatter, public readonly channel: Channel) {
        super(LeaveEvent);
    }

    getChatter(): Chatter {
        return this.chatter;
    }

    getChannel(): Channel {
        return this.channel;
    }
}