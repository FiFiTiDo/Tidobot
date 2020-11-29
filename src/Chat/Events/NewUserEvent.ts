import { User } from "../../Database/Entities/User";
import { ExtraKey } from "../../Systems/Event/EventExtra";

export class NewUserEvent {
    public static readonly EVENT_TYPE = "chat.events.NewUserEvent";
    public static readonly EXTRA_USER = new ExtraKey<User>("chat.event.NewUserEvent:extra.user");
}