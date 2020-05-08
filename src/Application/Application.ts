import {AdapterOptions} from "../Services/Adapter";
import args from "args";
import moment from "moment";
import {inject, injectable} from "inversify";
import symbols from "../symbols";
import Bot from "./Bot";
import Logger from "../Utilities/Logger";
import {provide} from "inversify-binding-decorators";
import Database from "../Database/Database";

@provide(Application)
export default class Application {
    public static readonly DEFAULT_CHANNEL = "@@__default__@@";

    private static readonly startTime: moment.Moment = moment();

    constructor(@inject(Bot) private bot: Bot) {
    }

    public async start(argv: string[]): Promise<void> {
        Logger.get().info("Initializing database");
        try {
            await Database.initialize();
        } catch (e) {
            Logger.get().emerg("Unable to initialize the database", { cause: e });
            process.exit(1);
        }
        Logger.get().info("Database initialized successfully");
        Logger.get().info("Application started.");

        const options = args
            .option("service", "The service the bot will run.", "twitch")
            .option("identity", "The identity to use, specified in the service's config files.", "default")
            .option("silent", "Enable silent mode, will not send any messages.", false)
            .option("channels", "The channels where the bot will enter.", [Application.DEFAULT_CHANNEL])
            .parse(argv);

        Logger.get().debug("Application#runCommand executed.");
        this.bot.start(options as AdapterOptions);
    }

    public static getUptime(): moment.Duration {
        return moment.duration(this.startTime.diff(moment()));
    }
}