import Event from "../../Systems/Event/Event";
import ChatterEntity from "../../Database/Entities/ChatterEntity";
import ChannelEntity from "../../Database/Entities/ChannelEntity";

export default class JoinEvent extends Event<JoinEvent> {
    public static readonly NAME = "chat_join";

    constructor(private readonly chatter: ChatterEntity, private readonly channel: ChannelEntity) {
        super(JoinEvent.NAME);
    }

    getChatter(): ChatterEntity {
        return this.chatter;
    }

    getChannel(): ChannelEntity {
        return this.channel;
    }
}