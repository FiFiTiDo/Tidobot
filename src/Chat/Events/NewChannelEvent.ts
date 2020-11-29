import { Channel } from "../../Database/Entities/Channel";
import { ExtraKey } from "../../Systems/Event/EventExtra";

export class NewChannelEvent {
    public static readonly EVENT_TYPE = "chat.events.NewChannelEvent";
    public static readonly EXTRA_CHANNEL = new ExtraKey<Channel>("chat.event.NewChannelEvent:extra.channel");
}