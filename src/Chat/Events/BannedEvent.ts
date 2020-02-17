import Event from "../../Event/Event";
import Chatter from "../Chatter";
import Channel from "../Channel";

export default class BannedEvent extends Event<BannedEvent> {
    public static readonly NAME = "chat_banned";

    private readonly chatter: Chatter;
    private readonly channel: Channel;
    private readonly duration: number;
    private readonly reason: string | null;

    constructor(chatter: Chatter, channel: Channel, duration: number, reason: string | null) {
        super(BannedEvent.NAME);
        this.chatter = chatter;
        this.channel = channel;
        this.duration = duration;
        this.reason = reason;
    }

    getChatter() {
        return this.chatter;
    }

    getChannel() {
        return this.channel;
    }

    getDuration() {
        return this.duration;
    }

    getReason() {
        return this.reason;
    }

    isPermanent() {
        return this.duration < 0;
    }
}