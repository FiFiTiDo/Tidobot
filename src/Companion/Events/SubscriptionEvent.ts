import { Chatter } from "../../Database/Entities/Chatter";
import { ExtraKey } from "../../Systems/Event/EventExtra";
import Optional from "../../Utilities/Patterns/Optional";
import {Channel} from "../../Database/Entities/Channel";

export class SubscriptionEvent {
    public static readonly EVENT_TYPE = "companion.events.SubscriptionEvent";
    public static readonly EXTRA_CHATTER = new ExtraKey<Chatter>("companion.events.SubscriptionEvent:extra.chatter");
    public static readonly EXTRA_TYPE = new ExtraKey<Optional<string>>("companion.events.SubscriptionEvent:extra.amount");
    public static readonly EXTRA_MESSAGE = new ExtraKey<Optional<string>>("companion.events.SubscriptionEvent:extra.message");
    public static readonly EXTRA_MONTHS = new ExtraKey<number>("companion.events.SubscriptionEvent:extra.months");
    public static readonly EXTRA_CHANNEL = new ExtraKey<Channel>("companion.events.SubscriptionEvent:extra.channel");
}