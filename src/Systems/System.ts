import {getLogger, Logger} from "log4js";

export default abstract class System {
    protected logger: Logger;

    protected constructor(private name: string) {
        this.logger = getLogger(name);
    }

    public getLogger(): Logger {
        return this.logger;
    }

}