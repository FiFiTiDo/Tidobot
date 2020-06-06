import {AdapterOptions} from "../Services/Adapter";
import args from "args";
import moment from "moment";
import {inject} from "inversify";
import Bot from "./Bot";
import {provide} from "inversify-binding-decorators";
import Database from "../Database/Database";
import {getLogger} from "../Utilities/Logger";

@provide(Application)
export default class Application {
    public static readonly DEFAULT_CHANNEL = "@@__default__@@";

    private static readonly startTime: moment.Moment = moment();

    constructor(@inject(Bot) private bot: Bot) {
    }

    public static getUptime(): moment.Duration {
        return moment.duration(this.startTime.diff(moment()));
    }

    public async start(argv: string[]): Promise<void> {
        const logger = getLogger("app");

        logger.info("Initializing database");
        try {
            await Database.initialize();
        } catch (e) {
            logger.fatal("Unable to initialize the database", {cause: e});
            process.exit(1);
        }
        logger.info("Database initialized successfully");
        logger.info("Application started.");

        const options = args
            .option("service", "The service the bot will run.", "twitch")
            .option("identity", "The identity to use, specified in the service's config files.", "default")
            .option("silent", "Enable silent mode, will not send any messages.", false)
            .option("channels", "The channels where the bot will enter.", [Application.DEFAULT_CHANNEL])
            .parse(argv);

        return this.bot.start(options as AdapterOptions);
    }
}