import Dispatcher from "./Dispatcher";
import {getLogger} from "../../Utilities/Logger";
import { Service } from "typedi";

@Service()
export default class EventSystem extends Dispatcher {
    private static LOGGER = getLogger("EventSystem");

    constructor() {
        super();
        EventSystem.LOGGER.info("System initialized");
    }
}