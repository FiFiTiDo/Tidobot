import Adapter, {AdapterOptions} from "../Services/Adapter";
import ModuleManager from "../Modules/ModuleManager";
import ConnectedEvent from "../Chat/Events/ConnectedEvent";
import DisconnectedEvent from "../Chat/Events/DisconnectedEvent";
import MessageEvent from "../Chat/Events/MessageEvent";
import * as winston from "winston"
import CommandModule from "../Modules/CommandModule";
import PermissionModule from "../Modules/PermissionModule";
import SettingsModule from "../Modules/SettingsModule";
import GeneralModule from "../Modules/GeneralModule";
import ChannelManager from "../Chat/ChannelManager";
import * as util from "util";
import ChatterManager from "../Chat/ChatterManager";
import ConfirmationModule from "../Modules/ConfirmationModule";
import {error_format} from "../Utilities/functions";
import Dictionary, {FileDictionaryParser} from "../Utilities/Dictionary";
import Translator from "../Utilities/Translator";
import CustomCommandModule from "../Modules/CustomCommandModule";
import {EventPriority} from "../Event/EventPriority";
import args from "args";
import JoinEvent from "../Chat/Events/JoinEvent";
import LeaveEvent from "../Chat/Events/LeaveEvent";
import ListModule from "../Modules/ListModule";
import Cache from "../Utilities/Cache";
import PollsModule from "../Modules/PollsModule";
import CounterModule from "../Modules/CounterModule";
import FunModule from "../Modules/FunModule";
import ExpressionModule from "../Modules/ExpressionModule";
import NewsModule from "../Modules/NewsModule";
import RaffleModule from "../Modules/RaffleModule";
import CurrencyModule from "../Modules/CurrencyModule";
import FilterModule from "../Modules/FilterModule";
import BettingModule from "../Modules/BettingModule";
import Database from "../Database/Database";
import GroupsModule from "../Modules/GroupsModule";
import moment from "moment";

require("winston-daily-rotate-file");

export default class Application {
    public static readonly DEFAULT_CHANNEL = "@@__default__@@";

    private static cache: Cache;
    private static logger: winston.Logger;
    private static db: Database;
    private static translator: Translator;
    private static config: Dictionary;
    private static channelManager: ChannelManager;
    private static chatterManager: ChatterManager;
    private static mm: ModuleManager;
    private static adapter: Adapter;
    private static readonly startTime: moment.Moment = moment();
    private readonly adapters: { [key: string]: Adapter };

    constructor() {
        this.adapters = {};
        Application.cache = new Cache({
            host: "127.0.0.1",
            port: 6379
        });
        Application.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                error_format()
            ),
            transports: [
                new winston.transports.Console({
                    format: winston.format.combine(
                        winston.format.colorize(),
                        winston.format.simple()
                    )
                }),
                new (winston.transports as any).DailyRotateFile({
                    filename: 'logs/application-%DATE%.log',
                    datePattern: 'YYYY-MM-DD-HH',
                    zippedArchive: true,
                    maxSize: '20m',
                    maxFiles: '14d',
                    format: winston.format.json()
                }),
            ]
        });
        Application.chatterManager = new ChatterManager();
        Application.channelManager = new ChannelManager();
    }

    public static getCache(): Cache {
        return this.cache;
    }

    public static getLogger(): winston.Logger {
        return this.logger;
    }

    public static getDatabase(): Database {
        return this.db;
    }

    public static getTranslator(): Translator {
        if (!this.translator) this.translator = new Translator();
        return this.translator;
    }

    public static getConfig(): Dictionary {
        if (!this.config) this.config = FileDictionaryParser.parseSync("config", JSON.parse);
        return this.config;
    }

    public static getChannelManager(): ChannelManager {
        return this.channelManager;
    }

    public static getChatterManager(): ChatterManager {
        return this.chatterManager;
    }

    public static getModuleManager(): ModuleManager {
        return this.mm;
    }

    public static getAdapter(): Adapter {
        return this.adapter;
    }

    public registerAdapter(key: string, adapter: Adapter) {
        this.adapters[key] = adapter;
    }

    public start(argv: string[]) {
        Application.getLogger().debug("Application started.");
        args
            .option("service", "The service the bot will run.", "twitch")
            .option("identity", "The identity to use, specified in the service's config files.", "default")
            .option("silent", "Enable silent mode, will not send any messages.", false)
            .option("channels", "The channels where the bot will enter.", [Application.DEFAULT_CHANNEL])
            .command("run", "Run the bot", this.runCommand)
            .command("services", "List all available services", this.servicesCommand)
            .parse(argv);
    }

    public runCommand = async (name: string, sub: string[], options: { [key: string]: any }) => {
        Application.getLogger().debug("Application#runCommand executed.");
        if (!this.adapters.hasOwnProperty(options.service)) {
            Application.getLogger().error("User specified an invalid service.", {input: options.service});
            throw new Error("Invalid service " + options.service + ", try the services command to find a list of valid services.");
        }

        Application.getLogger().info("Starting the service " + options.service + "...");

        Application.db = await Database.create(options.service);
        Application.adapter = this.adapters[options.service];
        Application.adapter.addListener(MessageEvent, (event: MessageEvent) => {
            let msg = event.getMessage();
            Application.getLogger().info(util.format("[%s] %s: %s", msg.getChannel().getName(), msg.getChatter().getName(), msg.getRaw()));
            if (msg.getChatter().isBanned() || msg.getChatter().isIgnored()) event.stopPropagation();
        }, EventPriority.HIGHEST);
        Application.adapter.addListener(JoinEvent, (event: JoinEvent) => {
            Application.getLogger().info(util.format("%s has joined %s", event.getChatter().getName(), event.getChannel().getName()));
        });
        Application.adapter.addListener(LeaveEvent, (event: LeaveEvent) => {
            Application.getLogger().info(util.format("%s has left %s", event.getChatter().getName(), event.getChannel().getName()));
        });
        Application.adapter.addListener(ConnectedEvent, (event: ConnectedEvent) => {
            Application.getLogger().info("Connected to the service.");
        }, EventPriority.MONITOR);
        Application.adapter.addListener(DisconnectedEvent, (event: DisconnectedEvent) => {
            Application.getLogger().info("Disconnected from the service.", {reason: event.getMetadata("reason", "Unknown")});
        }, EventPriority.MONITOR);

        Application.mm = new ModuleManager();
        Application.mm.registerModule(new ConfirmationModule());
        Application.mm.registerModule(new CommandModule());
        Application.mm.registerModule(new PermissionModule());
        Application.mm.registerModule(new GroupsModule());
        Application.mm.registerModule(new SettingsModule());
        Application.mm.registerModule(new GeneralModule());
        Application.mm.registerModule(new CustomCommandModule());
        Application.mm.registerModule(new ListModule());
        Application.mm.registerModule(new PollsModule());
        Application.mm.registerModule(new CounterModule());
        Application.mm.registerModule(new FunModule());
        Application.mm.registerModule(new ExpressionModule());
        Application.mm.registerModule(new NewsModule());
        Application.mm.registerModule(new RaffleModule());
        Application.mm.registerModule(new CurrencyModule());
        Application.mm.registerModule(new FilterModule());
        Application.mm.registerModule(new BettingModule());
        Application.mm.init();
        Application.adapter.run(options as AdapterOptions);
    };

    public servicesCommand = (name: string, sub: string[], options: { [key: string]: any }) => {
        Application.getLogger().debug("Application#servicesCommand executed.");
        console.log("Available services:\n" + Object.keys(this.adapters).join(", "));
    };

    public static getUptime(): moment.Duration {
        return moment.duration(this.startTime.diff(moment()));
    }
}