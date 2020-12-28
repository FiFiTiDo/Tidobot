import { ChannelIdentity } from "../../Database/Entities/ChannelIdentity";
import { ExtraKey } from "../../Systems/Event/EventExtra";

export enum CloseCode {
    NORMAL = 1000, GOING_AWAY = 1001, PROTOCOL_ERROR = 1002, UNSUPPORTED = 1003, RESERVED = 1004, NO_STATUS = 1005, ABNORMAL = 1006,
    UNSUPPORTED_PAYLOAD = 1007, POLICY_VIOLATION = 1008, TOO_LARGE = 1009, MANDATORY_EXTENSION = 1010, SERVER_ERROR = 1011, SERVICE_RESTART = 1012,
    TRY_AGAIN_LATER = 1013, BAD_GATEWAY = 1014, TLS_HANDSHAKE_FAIL = 1015
}

export class CompanionDisconnectedEvent {
    public static readonly EVENT_TYPE = "companion.events.CompanionDisconnectedEvent";
    public static readonly EXTRA_IDENTITY = new ExtraKey<ChannelIdentity>("companion.events.CompanionDisconnectedEvent:extra.identity");
    public static readonly EXTRA_CODE = new ExtraKey<CloseCode>("companion.events.CompanionDisconnectedEvent:extra.code");
    public static readonly EXTRA_REASON = new ExtraKey<string>("companion.events.CompanionDisconnectedEvent:extra.reason");
}