import {AdapterOptions} from "../Adapters/Adapter";
import args from "args";
import moment from "moment";
import Bot from "./Bot";
import {getLogger} from "../Utilities/Logger";
import {Logger} from "log4js";
import EventSystem from "../Systems/Event/EventSystem";
import ShutdownEvent from "./Events/ShutdownEvent";
import TimerSystem, { TimeUnit } from "../Systems/Timer/TimerSystem";
import { Service } from "typedi";
import TickEvent from "./Events/TickEvent";
import Event from "../Systems/Event/Event";

@Service()
export default class Application {
    public static readonly DEFAULT_CHANNEL = "@@__default__@@";
    private static readonly startTime: moment.Moment = moment();

    private logger: Logger = getLogger("app");

    constructor(
        private readonly bot: Bot,
        private readonly timerSystem: TimerSystem,
        private readonly eventSystem: EventSystem
    ) {}

    public static getUptime(): moment.Duration {
        return moment.duration(this.startTime.diff(moment()));
    }

    public async start(argv: string[]): Promise<void> {
        this.logger.info("Application started.");

        const options = args
            .option("service", "The service the bot will run.", "twitch")
            .option("identity", "The identity to use, specified in the service's config files.", "default")
            .option("silent", "Enable silent mode, will not send any messages.", false)
            .option("channels", "The channels where the bot will enter.", [Application.DEFAULT_CHANNEL])
            .parse(argv);

        this.timerSystem.startTimer(() => this.eventSystem.dispatch(new Event(TickEvent)), TimeUnit.Seconds(1));
        return this.bot.start(options as AdapterOptions);
    }

    public async shutdown(): Promise<boolean> {
        const event = new Event(ShutdownEvent);
        this.eventSystem.dispatch(event);
        if (event.cancelled) return false;
        await this.bot.shutdown();
        this.timerSystem.shutdown();
        this.logger.info("Bot shutting down...");
        return true;
    }
}