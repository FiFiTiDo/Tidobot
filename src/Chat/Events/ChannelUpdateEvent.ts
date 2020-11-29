import { Channel } from "../../Database/Entities/Channel";
import { ExtraKey } from "../../Systems/Event/EventExtra";

export enum ChannelUpdateType {
    ONLINE_STATUS
}

export class ChannelUpdateEvent {
    public static readonly EVENT_TYPE = "chat.events.ChannelUpdateEvent";
    public static readonly EXTRA_CHANNEL = new ExtraKey<Channel>("chat.event.ChannelUpdateEvent:extra.channel");
    public static readonly EXTRA_UPDATE_TYPE = new ExtraKey<ChannelUpdateType>("chat.event.ChannelUpdateEvent:extra.type");
    public static readonly EXTRA_CHANNEL_ONLINE = new ExtraKey<boolean>("chat.events.ChannelUpdateEvent:extra.online");
}