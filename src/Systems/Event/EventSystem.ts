import Dispatcher from "./Dispatcher";
import {getLogger} from "../../Utilities/Logger";

export default class EventSystem extends Dispatcher {
    private static LOGGER = getLogger("EventSystem");
    private static instance: EventSystem = null;

    constructor() {
        super();
        EventSystem.LOGGER.info("System initialized");
    }

    public static getInstance() {
        if (this.instance === null)
            this.instance = new EventSystem();

        return this.instance;
    }
}