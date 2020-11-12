import AbstractModule, {Symbols} from "./AbstractModule";
import moment from "moment-timezone";
import {arrayRand} from "../Utilities/ArrayUtils";
import Permission from "../Systems/Permissions/Permission";
import {Role} from "../Systems/Permissions/Role";
import Setting, {SettingType} from "../Systems/Settings/Setting";
import Command from "../Systems/Commands/Command";
import Message from "../Chat/Message";
import {ExpressionContext} from "../Systems/Expressions/ExpressionSystem";
import {CommandHandler} from "../Systems/Commands/Validation/CommandHandler";
import CheckPermission from "../Systems/Commands/Validation/CheckPermission";
import {MessageArg, ResponseArg, RestArguments, Sender} from "../Systems/Commands/Validation/Argument";
import {Response} from "../Chat/Response";
import {returnError, validateFunction} from "../Utilities/ValidateFunction";
import Application from "../Application/Application";
import {getLogger, logError} from "../Utilities/Logger";
import { Service } from "typedi";
import { Chatter } from "../Database/Entities/Chatter";
import Event from "../Systems/Event/Event";

export const MODULE_INFO = {
    name: "General",
    version: "1.2.0",
    description: "General bot commands that don't fit in other modules"
};

const logger = getLogger(MODULE_INFO.name);

@Service()
class PingCommand extends Command {
    constructor() {
        super("ping", null);
    }

    @CommandHandler("ping", "ping")
    @CheckPermission(() => GeneralModule.permissions.ping)
    async handleCommand(event: Event, @ResponseArg response: Response, @Sender sender: Chatter): Promise<void> {
        try {
            return response.message("pong", {username: sender.user.name});
        } catch (e) {
            logError(logger, e);
        }
    }
}

@Service()
class RawCommand extends Command {
    constructor() {
        super("raw", "<text>");
    }

    @CommandHandler("raw", "raw <text>")
    @CheckPermission(() => GeneralModule.permissions.raw)
    async handleCommand(event: Event, @ResponseArg response: Response, @RestArguments(true, {join: " "}) text: string): Promise<void> {
        return response.rawMessage(text);
    }
}

@Service()
class EchoCommand extends Command {
    constructor() {
        super("echo", "<message>");
    }

    @CommandHandler("echo", "echo <message>")
    @CheckPermission(() => GeneralModule.permissions.echo)
    async handleCommand(event: Event, @ResponseArg response: Response, @RestArguments(true, {join: " "}) message: string): Promise<void> {
        return response.rawMessage(">> " + message);
    }
}

@Service()
class EvalCommand extends Command {
    constructor() {
        super("eval", "<expression>");
    }

    @CommandHandler("eval", "eval <expression>")
    @CheckPermission(() => GeneralModule.permissions.eval)
    async handleCommand(
        event: Event, @ResponseArg response: Response, @MessageArg msg: Message,
        @RestArguments(true, {join: " "}) rawExpr: string
    ): Promise<void> {
        await response.rawMessage(">> " + await msg.evaluateExpression(rawExpr));
    }
}

@Service()
class ShutdownCommand extends Command {
    constructor(private readonly app: Application) {
        super("shutdown", null);
    }

    @CommandHandler("shutdown", "shutdown")
    @CheckPermission(() => GeneralModule.permissions.shutdown)
    async handleCommand(event: Event, @ResponseArg response: Response): Promise<void> {
        return this.app.shutdown()
            .then(async successful => successful ?
                await response.broadcast(arrayRand(await response.getTranslation<string[]>("shutdown"))) :
                await response.message("shutdown-cancelled")
            ).catch(e => response.genericErrorAndLog(e, logger));
    }
}

export const TIMEZONE_SETTING = new Setting("timezone", moment.tz.zone("America/New_York"), SettingType.TIMEZONE);

@Service()
export default class GeneralModule extends AbstractModule {
    static [Symbols.ModuleInfo] = MODULE_INFO;
    static permissions = {
        ping: new Permission("general.ping", Role.MODERATOR),
        raw: new Permission("general.raw", Role.OWNER),
        echo: new Permission("general.echo", Role.MODERATOR),
        eval: new Permission("general.eval", Role.MODERATOR),
        shutdown: new Permission("general.shutdown", Role.OWNER)
    }
    static settings = {
        timezone: new Setting("timezone", moment.tz.zone("America/New_York"), SettingType.TIMEZONE)
    }

    constructor(
        pingCommand: PingCommand, rawCommand: RawCommand, echoCommand: EchoCommand, evalCommand: EvalCommand, 
        shutdownCommand: ShutdownCommand
    ) {
        super(GeneralModule);

        this.coreModule = true;
        this.registerCommand(pingCommand);
        this.registerCommand(rawCommand);
        this.registerCommand(echoCommand);
        this.registerCommand(evalCommand);
        this.registerCommand(shutdownCommand);
        this.registerPermissions(GeneralModule.permissions);
        this.registerSettings(GeneralModule.settings);
        this.registerExpressionContextResolver(this.expressionContextResolver);
    }

    expressionContextResolver(msg: Message): ExpressionContext {
        return {
            datetime: validateFunction((format = "Y-m-d h:i:s"): string => {
                const timezone = msg.channel.settings.get(GeneralModule.settings.timezone);
                return moment().tz(timezone.name).format(format);
            }, ["string"], returnError())
        };
    }
}