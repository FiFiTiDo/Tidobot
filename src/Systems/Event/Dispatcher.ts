import Listener, {ListenerWrapper} from "./Listener";
import Event, {EventConstructor} from "./Event";
import {EventPriority} from "./EventPriority";
import PriorityList from "../../Utilities/Structures/PriorityList";
import {injectable} from "inversify";

type ListenerType<T extends Event<T>> = Listener<T> | ListenerWrapper<T>;

@injectable()
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

    public async dispatch<T extends Event<T>>(event: Event<T>): Promise<void> {
        if (!this.listeners.has(event.getName())) return;

        for (const listener of this.listeners.get(event.getName())) {
            let value;
            if (typeof listener === "function")
                value = listener.call(null, event.getEventArgs());
            else
                value = listener.func.call(listener.thisArg, event.getEventArgs());
            if (value instanceof Promise) value = await value;
            if (event.isPropagationStopped()) break;
        }
    }
}

export abstract class Subscriber {
    abstract registerListeners(dispatcher: Dispatcher);

    abstract unregisterListeners(dispatcher: Dispatcher);
}