import { ExtraKey } from "../../Systems/Event/EventExtra";
import {Channel} from "../../Database/Entities/Channel";

export class TipEvent {
    public static readonly EVENT_TYPE = "companion.events.TipEvent";
    public static readonly EXTRA_NAME = new ExtraKey<string>("companion.events.TipEvent:extra.name");
    public static readonly EXTRA_AMOUNT = new ExtraKey<number>("companion.events.TipEvent:extra.amount");
    public static readonly EXTRA_MESSAGE = new ExtraKey<string>("companion.events.TipEvent:extra.message");
    public static readonly EXTRA_CHANNEL = new ExtraKey<Channel>("companion.events.TipEvent:extra.channel");
}