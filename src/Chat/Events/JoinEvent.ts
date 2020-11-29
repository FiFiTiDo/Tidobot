import { Channel } from "../../Database/Entities/Channel";
import { Chatter } from "../../Database/Entities/Chatter";
import { ExtraKey } from "../../Systems/Event/EventExtra";

export default class JoinEvent {
    public static readonly EVENT_TYPE = "chat.events.JoinEvent";
    public static readonly EXTRA_CHATTER = new ExtraKey<Chatter>("chat.events.JoinEvent:extra.chatter");
    public static readonly EXTRA_CHANNEL = new ExtraKey<Channel>("chat.events.JoinEvent:extra.channel");
}