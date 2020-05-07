import Event from "../../Systems/Event/Event";

export default class ConnectedEvent extends Event<ConnectedEvent> {
    public static readonly NAME: string = "chat_connected";

    constructor() {
        super(ConnectedEvent.NAME);
    }
}