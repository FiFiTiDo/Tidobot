import Event from "../../Event/Event";
import Channel from "../Channel";
import Chatter from "../Chatter";

export default class JoinEvent extends Event<JoinEvent> {
    public static readonly NAME = "chat_join";

    private readonly chatter: Chatter;
    private readonly channel: Channel;

    constructor(chatter: Chatter, channel: Channel) {
        super(JoinEvent.NAME);

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