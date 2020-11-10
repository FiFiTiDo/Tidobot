import { ExtraKey } from "../../Systems/Event/EventExtra";

export default class DisconnectedEvent {
    public static readonly EVENT_TYPE = "chat.events.DisconnectedEvent";
    public static readonly EXTRA_REASON = new ExtraKey<string>("chat.events.DisconnectedEvent:extra.reason");
}