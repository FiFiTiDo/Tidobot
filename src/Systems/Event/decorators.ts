import Event, {EventConstructor} from "./Event";
import Listener from "./Listener";
import EventSystem from "./EventSystem";
import {EventPriority} from "./EventPriority";

export function EventHandler<T extends Event<T>>(event: EventConstructor<T>, priority = EventPriority.NORMAL): Function {
    return function (target: object, key: string | symbol, descriptor: TypedPropertyDescriptor<Listener<T>>): void {
        EventSystem.getInstance().addListener(event, { thisArg: target, func: descriptor.value }, priority);
    };
}