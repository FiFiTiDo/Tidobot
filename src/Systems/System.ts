import {Logger} from "log4js";
import {getLogger, logError} from "../Utilities/Logger";

export default abstract class System {
    protected logger: Logger;

    protected constructor(private name: string) {
        this.logger = getLogger(name);
    }

    public async initialize(): Promise<void> {
        this.logger.info("System initializing");
        try {
            await this.onInitialize();
            this.logger.info("System initalization complete");
            this.onInitialized();
        } catch (e) {
            logError(this.logger, e, "Failed to initalize system", true);
            process.exit(1);
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    public async onInitialize(): Promise<void> {}
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    public onInitialized(): void {}

    public getLogger(): Logger {
        return this.logger;
    }

}