import { ChannelIdentity } from "../../Database/Entities/ChannelIdentity";
import { ExtraKey } from "../../Systems/Event/EventExtra";
import { ClientHandler } from "../ClientHandler";

export class CompanionErrorEvent {
    public static readonly EVENT_TYPE = "companion.events.CompanionErrorEvent";
    public static readonly EXTRA_CLIENT = new ExtraKey<ClientHandler>("companion.events.CompanionErrorEvent:extra.client");
    public static readonly EXTRA_IDENTITY = new ExtraKey<ChannelIdentity|null>("companion.events.CompanionErrorEvent:extra.identity");
    public static readonly EXTRA_ERROR = new ExtraKey<Error>("companion.events.CompanionErrorEvent:extra.error");
}