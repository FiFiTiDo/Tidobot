import { Channel } from "../../Database/Entities/Channel";
import { Chatter } from "../../Database/Entities/Chatter";
import Event from "../../Systems/Event/Event";

export default class BannedEvent extends Event<BannedEvent> {
    public static readonly NAME = "chat_banned";

    constructor(public readonly chatter: Chatter, public readonly channel: Channel, private readonly duration: number, private readonly reason: string | null) {
        super(BannedEvent);
    }

    getChatter(): Chatter {
        return this.chatter;
    }

    getChannel(): Channel {
        return this.channel;
    }

    getDuration(): number {
        return this.duration;
    }

    getReason(): string | null {
        return this.reason;
    }

    isPermanent(): boolean {
        return this.duration < 0;
    }
}