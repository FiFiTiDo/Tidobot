import {Listener, ListenerWrapper} from "./Listener";
import Event, { EventType } from "./Event";
import {EventPriority} from "./EventPriority";
import PriorityList from "../../Utilities/Structures/PriorityList";

type ListenerType = Listener | ListenerWrapper;

export default class Dispatcher {
    private listeners: Map<string, PriorityList<ListenerType>> = new Map();

    public addListener(type: EventType, listener: ListenerType, priority = EventPriority.NORMAL): void {
        if (!this.listeners.has(type.EVENT_TYPE))
            this.listeners.set(type.EVENT_TYPE, new PriorityList());
        this.listeners.get(type.EVENT_TYPE).push(listener, priority);
    }

    public removeListener(type: EventType, listener: ListenerType): void {
        if (!this.listeners.has(type.EVENT_TYPE)) return;
        this.listeners.get(type.EVENT_TYPE).remove(listener);
    }

    public async dispatch(event: Event): Promise<void> {
        if (!this.listeners.has(event.name)) return;

        for (const listener of this.listeners.get(event.name)) {
            let value;
            if (typeof listener === "function")
                value = listener.call(null, event);
            else
                value = listener.func.call(listener.thisArg, event);
            if (value instanceof Promise) value = await value;
            if (event.cancelled) break;
        }
    }
}