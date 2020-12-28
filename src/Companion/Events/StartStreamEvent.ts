import { ExtraKey } from "../../Systems/Event/EventExtra";
import {Channel} from "../../Database/Entities/Channel";

export class StartStreamEvent {
    public static readonly EVENT_TYPE = "companion.events.StartStreamEvent";
    public static readonly EXTRA_CHANNEL = new ExtraKey<Channel>("companion.events.StartStreamEvent:extra.channel");
}