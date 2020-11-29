import { Channel } from "../../Database/Entities/Channel";
import { Chatter } from "../../Database/Entities/Chatter";
import { ExtraKey } from "../../Systems/Event/EventExtra";

export default class BannedEvent {
    public static readonly EVENT_TYPE = "chat.events.BannedEvent";
    public static readonly EXTRA_CHATTER = new ExtraKey<Chatter>("chat.events.BannedEvent:extra.chatter");
    public static readonly EXTRA_CHANNEL = new ExtraKey<Channel>("chat.events.BannedEvent:extra.channel");
    public static readonly EXTRA_DURATION = new ExtraKey<number>("chat.events.BannedEvent:extra.duration");
    public static readonly EXTRA_REASON = new ExtraKey<string>("chat.events.BannedEvent:extra.reason");
}