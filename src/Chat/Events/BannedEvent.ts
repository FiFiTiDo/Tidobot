import Event from "../../Systems/Event/Event";
import ChatterEntity from "../../Database/Entities/ChatterEntity";
import ChannelEntity from "../../Database/Entities/ChannelEntity";

export default class BannedEvent extends Event<BannedEvent> {
    public static readonly NAME = "chat_banned";

    constructor(private readonly chatter: ChatterEntity, private readonly channel: ChannelEntity, private readonly duration: number, private readonly reason: string | null) {
        super(BannedEvent.NAME);
    }

    getChatter(): ChatterEntity {
        return this.chatter;
    }

    getChannel(): ChannelEntity {
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