import {AdapterOptions} from "../Services/Adapter";
import args from "args";
import moment from "moment";
import {inject, injectable} from "inversify";
import symbols from "../symbols";
import Bot from "./Bot";
import Logger from "../Utilities/Logger";
import {Database} from "sqlite3";

@injectable()
export default class Application {
    public static readonly DEFAULT_CHANNEL = "@@__default__@@";

    private static db: Database;
    private static readonly startTime: moment.Moment = moment();

    constructor(@inject(symbols.Logger) private logger: Logger, @inject(symbols.Logger) private db: Database, private bot: Bot) {
    }

    public static getDatabase(): Database {
        return this.db;
    }

    public start(argv: string[]): void {
        Logger.get().debug("Application started.");

        const options = args
            .option("service", "The service the bot will run.", "twitch")
            .option("identity", "The identity to use, specified in the service's config files.", "default")
            .option("silent", "Enable silent mode, will not send any messages.", false)
            .option("channels", "The channels where the bot will enter.", [Application.DEFAULT_CHANNEL])
            .parse(argv);

        Logger.get().debug("Application#runCommand executed.");
        Application.db = this.db;
        this.bot.start(options as AdapterOptions);
    }

    public static getUptime(): moment.Duration {
        return moment.duration(this.startTime.diff(moment()));
    }
}