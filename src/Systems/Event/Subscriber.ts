import Dispatcher from "./Dispatcher";

export default abstract class Subscriber {
    abstract registerListeners(dispatcher: Dispatcher);

    abstract unregisterListeners(dispatcher: Dispatcher);
}

