import Event, {EventArguments, EventConstructor} from "./Event";
import Listener from "./Listener";
import EventSystem from "./EventSystem";
import {EventPriority} from "./EventPriority";
import {addMetadata, getMetadata} from "../../Utilities/DecoratorUtils";
import Container from "typedi";

const EVENT_META_KEY = "handler:events";

interface EventHandler<T extends Event<T>> {
    event: EventConstructor<T>;
    priority: EventPriority;
    func: Listener<T, EventArguments<T>>;
}

export function HandlesEvents() {
    return function <T extends { new(...args: any[]): any }>(constructor: T): T {
        return class extends constructor {
            constructor(...args: any[]) {
                super(...args);
                for (const handler of getMetadata<EventHandler<any>[]>(EVENT_META_KEY, this.constructor)) {
                    Container.get(EventSystem).addListener(handler.event, {
                        thisArg: this,
                        func: handler.func
                    }, handler.priority);
                }
            }
        }
    }
}

export function EventHandler<T extends Event<T>, TArgs extends EventArguments<T>>(event: EventConstructor<T>, priority = EventPriority.NORMAL): Function {
    return function (target: object, key: string | symbol, descriptor: TypedPropertyDescriptor<Listener<T, TArgs>>): void {
        addMetadata<EventHandler<T>>(EVENT_META_KEY, target.constructor, {event, priority, func: descriptor.value});
    };
}