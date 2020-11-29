import { Listener } from "./Listener";
import EventSystem from "./EventSystem";
import {EventPriority} from "./EventPriority";
import {addMetadata, getMetadata} from "../../Utilities/DecoratorUtils";
import Container from "typedi";
import { EventType } from "./Event";

const EVENT_META_KEY = "handler:events";

interface EventHandler {
    type: EventType;
    priority: EventPriority;
    func: Listener;
}

export function HandlesEvents() {
    return function <T extends { new(...args: any[]): any }>(constructor: T): T {
        return class extends constructor {
            constructor(...args: any[]) {
                super(...args);
                const handlers = getMetadata<EventHandler[]>(EVENT_META_KEY, this.constructor) || [];
                for (const handler of handlers) {
                    Container.get(EventSystem).addListener(handler.type, {
                        thisArg: this,
                        func: handler.func
                    }, handler.priority);
                }
            }
        };
    };
}

export function EventHandler(type: EventType, priority = EventPriority.NORMAL): Function {
    return function (target: object, key: string | symbol, descriptor: TypedPropertyDescriptor<Listener>): void {
        addMetadata<EventHandler>(EVENT_META_KEY, target.constructor, {type, priority, func: descriptor.value});
    };
}