import { Channel } from "../../Database/Entities/Channel";
import { Chatter } from "../../Database/Entities/Chatter";
import { ExtraKey } from "../../Systems/Event/EventExtra";

export default class LeaveEvent {
    public static readonly EVENT_TYPE = "chat.events.LeaveEvent";
    public static readonly EXTRA_CHATTER = new ExtraKey<Chatter>("chat.events.LeaveEvent:extra.chatter");
    public static readonly EXTRA_CHANNEL = new ExtraKey<Channel>("chat.events.LeaveEvent:extra.channel");
}