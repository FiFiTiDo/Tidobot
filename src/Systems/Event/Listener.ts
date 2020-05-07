import Event, {EventArguments} from "./Event";

export default interface Listener<T extends Event<T>> {
    (eventArgs: EventArguments<T>): void;
}

export interface ListenerWrapper<T extends Event<T>> {
    thisArg: object;
    func: Listener<T>;
}