import Dispatcher from "./Dispatcher";

export default class EventSystem extends Dispatcher {
    private static instance: EventSystem = null;

    public static getInstance() {
        if (this.instance === null)
            this.instance = new EventSystem();

        return this.instance;
    }
}