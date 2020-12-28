import { Chatter } from "../../Database/Entities/Chatter";
import { ExtraKey } from "../../Systems/Event/EventExtra";
import {Channel} from "../../Database/Entities/Channel";

export class FollowEvent {
    public static readonly EVENT_TYPE = "companion.events.FollowEvent";
    public static readonly EXTRA_CHATTER = new ExtraKey<Chatter>("companion.events.FollowEvent:extra.name");
    public static readonly EXTRA_CHANNEL = new ExtraKey<Channel>("companion.events.FollowEvent:extra.channel");
}