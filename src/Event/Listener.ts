import Event from "./Event";

export type Listener<T extends Event<T>> = (event: T) => void;