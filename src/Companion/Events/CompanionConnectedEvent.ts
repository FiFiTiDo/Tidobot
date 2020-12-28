import { ExtraKey } from "../../Systems/Event/EventExtra";
import {Channel} from "../../Database/Entities/Channel";

export class CompanionConnectedEvent {
    public static readonly EVENT_TYPE = "companion.events.CompanionConnectedEvent";
    public static readonly EXTRA_CHANNEL = new ExtraKey<Channel>("companion.events.CompanionConnectedEvent:extra.channel");
}