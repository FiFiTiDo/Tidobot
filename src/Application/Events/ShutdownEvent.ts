import Event from "../../Systems/Event/Event";

export default class ShutdownEvent extends Event<ShutdownEvent> {
    static NAME: "bot_shutdown";

    constructor() {
        super(ShutdownEvent);
    }
}