import Listener, {ListenerWrapper} from "./Listener";
import Event, {EventConstructor} from "./Event";
import {EventPriority} from "./EventPriority";
import PriorityList from "../../Utilities/Structures/PriorityList";
import Subscriber from "./Subscriber";

type ListenerType<T extends Event<T>> = Listener<T>|ListenerWrapper<T>;

export default class Dispatcher {
    private listeners: Map<string, PriorityList<ListenerType<any>>> = new Map();

    public addListener<T extends Event<T>>(event: EventConstructor<T>, listener: ListenerType<T>, priority = EventPriority.NORMAL): void {
        if (!this.listeners.has(event.NAME))
            this.listeners.set(event.NAME, new PriorityList());
        this.listeners.get(event.NAME).push(listener, priority);
    }

    public removeListener<T extends Event<T>>(event: EventConstructor<T>, listener: ListenerType<T>): void {
        if (!this.listeners.has(event.NAME)) return;
        this.listeners.get(event.NAME).remove(listener);
    }

    public addSubscriber(subscriber: Subscriber): void {
        subscriber.registerListeners(this);
    }

    public dispatch<T extends Event<T>>(event: Event<T>): void {
        if (!this.listeners.has(event.getName())) return;

        for (const listener of this.listeners.get(event.getName())) {
            if (typeof listener === "function")
                listener.call(null, event.getEventArgs());
            else
                listener.func.call(listener.thisArg, event.getEventArgs());
            if (event.isPropagationStopped()) break;
        }
    }
}