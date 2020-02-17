import {Listener} from "./Listener";
import Event, {EventConstructor} from "./Event";
import {EventPriority} from "./EventPriority";
import PriorityList from "../Utilities/PriorityList";
import Subscriber from "./Subscriber";

export default class Dispatcher {
    private listeners: { [key: string]: PriorityList<Listener<any>> } = {};

    public addListener<T extends Event<T>>(event: EventConstructor<T>, listener: Listener<T>, priority = EventPriority.NORMAL): void {
        if (!this.listeners.hasOwnProperty(event.NAME))
            this.listeners[event.NAME] = new PriorityList();

        this.listeners[event.NAME].push(listener, priority);
    }

    public removeListener<T extends Event<T>>(event: EventConstructor<T>, listener: Listener<T>): void {
        if (!this.listeners.hasOwnProperty(event.NAME)) return;

        this.listeners[event.NAME].remove(listener);
    }

    public addSubscriber(subscriber: Subscriber) {
        subscriber.registerListeners(this);
    }

    public dispatch(event: Event<any>): void {
        if (!this.listeners.hasOwnProperty(event.getName())) return;

        for (let listener of this.listeners[event.getName()]) {
            listener.call(null, event);
            if (event.isPropagationStopped()) break;
        }
    }
}