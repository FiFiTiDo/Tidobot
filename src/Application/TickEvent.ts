import Event from "../Event/Event";

export default class TickEvent extends Event<TickEvent> {
    public static readonly NAME = "tick";

    constructor() {
        super(TickEvent.NAME);
    }
}