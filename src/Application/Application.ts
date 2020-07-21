import {AdapterOptions} from "../Adapters/Adapter";
import args from "args";
import moment from "moment";
import {inject} from "inversify";
import Bot from "./Bot";
import {provide} from "inversify-binding-decorators";
import Database from "../Database/Database";
import {getLogger} from "../Utilities/Logger";
import {Logger} from "log4js";
import EventSystem from "../Systems/Event/EventSystem";
import ShutdownEvent from "./Events/ShutdownEvent";
import TimerSystem from "../Systems/Timer/TimerSystem";

@provide(Application)
export default class Application {
    public static readonly DEFAULT_CHANNEL = "@@__default__@@";
    private static readonly startTime: moment.Moment = moment();

    private logger: Logger = getLogger("app");

    constructor(@inject(Bot) private bot: Bot) {
    }

    public static getUptime(): moment.Duration {
        return moment.duration(this.startTime.diff(moment()));
    }

    public async start(argv: string[]): Promise<void> {
        this.logger.info("Initializing database");
        try {
            await Database.initialize();
        } catch (e) {
            this.logger.fatal("Unable to initialize the database", {cause: e});
            process.exit(1);
        }
        this.logger.info("Database initialized successfully");
        this.logger.info("Application started.");

        const options = args
            .option("service", "The service the bot will run.", "twitch")
            .option("identity", "The identity to use, specified in the service's config files.", "default")
            .option("silent", "Enable silent mode, will not send any messages.", false)
            .option("channels", "The channels where the bot will enter.", [Application.DEFAULT_CHANNEL])
            .parse(argv);

        return this.bot.start(options as AdapterOptions);
    }

    public async shutdown(): Promise<boolean> {
        const event = new ShutdownEvent();
        EventSystem.getInstance().dispatch(event);
        if (event.isCancelled()) return false;
        await this.bot.shutdown();
        TimerSystem.getInstance().shutdown();
        this.logger.info("Bot shutting down...");
        return true;
    }
}