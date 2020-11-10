import { ExtraKey } from "../../Systems/Event/EventExtra";
import Message from "../Message";

export default class MessageEvent {
    public static readonly EVENT_TYPE = "chat.events.MessageEvent";
    public static readonly EXTRA_MESSAGE = new ExtraKey<Message>("chat.events.MessageEvent:extra.message");
}