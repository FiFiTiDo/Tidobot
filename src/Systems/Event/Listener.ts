import Event, {EventArguments} from "./Event";

export default interface Listener<T extends Event<T>, TArgs extends EventArguments<T>> {
    (eventArgs: TArgs): void;
}

export interface ListenerWrapper<T extends Event<T>, TArgs extends EventArguments<T>> {
    thisArg: object;
    func: Listener<T, TArgs>;
}