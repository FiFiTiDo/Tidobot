import Event from "../../Event/Event";

export default class DisconnectedEvent extends Event<DisconnectedEvent> {
    public static readonly NAME: string = "chat_disconnected";

    constructor() {
        super(DisconnectedEvent.NAME);
    }
}