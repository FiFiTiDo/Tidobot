import {Logger} from "log4js";
import getLogger from "../Utilities/Logger";

export default abstract class System {
    protected logger: Logger;

    protected constructor(private name: string) {
        this.logger = getLogger(name);
    }

    public getLogger(): Logger {
        return this.logger;
    }

}