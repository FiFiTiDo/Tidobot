import { Channel } from "../../Database/Entities/Channel";
import { Chatter } from "../../Database/Entities/Chatter";
import { ExtraKey } from "../../Systems/Event/EventExtra";

export class NewChatterEvent {
    public static readonly EVENT_TYPE = "chat.events.NewChatterEvent";
    public static readonly EXTRA_CHATTER = new ExtraKey<Chatter>("chat.event.NewChatterEvent:extra.chatter");
    public static readonly EXTRA_CHANNEL = new ExtraKey<Channel>("chat.event.NewChatterEvent:extra.channel");
}