import Event from "../../Systems/Event/Event";
import { Channel } from "../../Database/Entities/Channel";
import { Chatter } from "../../Database/Entities/Chatter";

export default class JoinEvent extends Event<JoinEvent> {
    public static readonly NAME = "chat_join";

    constructor(public readonly chatter: Chatter, public readonly channel: Channel) {
        super(JoinEvent);
    }

    getChatter(): Chatter {
        return this.chatter;
    }

    getChannel(): Channel {
        return this.channel;
    }
}