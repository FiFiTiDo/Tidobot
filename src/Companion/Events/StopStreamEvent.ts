import { ExtraKey } from "../../Systems/Event/EventExtra";
import {Channel} from "../../Database/Entities/Channel";

export class StopStreamEvent {
    public static readonly EVENT_TYPE = "companion.events.StopStreamEvent";
    public static readonly EXTRA_CHANNEL = new ExtraKey<Channel>("companion.events.StopStreamEvent:extra.channel");
}