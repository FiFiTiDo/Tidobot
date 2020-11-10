import Event from "./Event";

export interface Listener {
    (event: Event): void;
}

export interface ListenerWrapper {
    thisArg: object;
    func: Listener;
}