import Event from "../../Event/Event";
import Channel from "../Channel";
import Chatter from "../Chatter";

export default class LeaveEvent extends Event<LeaveEvent> {
    public static readonly NAME = "chat_leave";

    private readonly chatter: Chatter;
    private readonly channel: Channel;

    constructor(chatter: Chatter, channel: Channel) {
        super(LeaveEvent.NAME);

        this.chatter = chatter;
        this.channel = channel;
    }

    getChatter() {
        return this.chatter;
    }

    getChannel() {
        return this.channel;
    }
}