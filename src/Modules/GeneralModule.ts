import AbstractModule, {Symbols} from "./AbstractModule";
import moment from "moment-timezone";
import {array_rand} from "../Utilities/ArrayUtils";
import Permission from "../Systems/Permissions/Permission";
import {Role} from "../Systems/Permissions/Role";
import Setting, {SettingType} from "../Systems/Settings/Setting";
import Command from "../Systems/Commands/Command";
import {CommandEvent} from "../Systems/Commands/CommandEvent";
import Bot from "../Application/Bot";
import {command} from "../Systems/Commands/decorators";
import Message from "../Chat/Message";
import {ExpressionContext} from "../Systems/Expressions/ExpressionSystem";
import {ExpressionContextResolver} from "../Systems/Expressions/decorators";
import {permission} from "../Systems/Permissions/decorators";
import {setting} from "../Systems/Settings/decorators";
import {CommandHandler} from "../Systems/Commands/Validation/CommandHandler";
import CheckPermission from "../Systems/Commands/Validation/CheckPermission";
import {MessageArg, ResponseArg, RestArguments, Sender} from "../Systems/Commands/Validation/Argument";
import {Response} from "../Chat/Response";
import ChatterEntity from "../Database/Entities/ChatterEntity";
import {returnErrorAsync, validateFunction} from "../Utilities/ValidateFunction";

export const MODULE_INFO = {
    name: "General",
    version: "1.1.0",
    description: "General bot commands that don't fit in other modules"
};

class PingCommand extends Command {
    constructor() {
        super("ping", null);
    }

    @CommandHandler("ping", "ping")
    @CheckPermission("general.ping")
    async handleCommand(event: CommandEvent, @ResponseArg response: Response, @Sender sender: ChatterEntity): Promise<void> {
        return response.message("pong", {username: sender.name});
    }
}

class RawCommand extends Command {
    constructor() {
        super("raw", "<text>");
    }

    @CommandHandler("raw", "raw <text>")
    @CheckPermission("general.raw")
    async handleCommand(event: CommandEvent, @ResponseArg response: Response, @RestArguments(true, {join: " "}) text: string): Promise<void> {
        return response.rawMessage(text);
    }
}

class EchoCommand extends Command {
    constructor() {
        super("echo", "<message>");
    }

    @CommandHandler("echo", "echo <message>")
    @CheckPermission("general.echo")
    async handleCommand(event: CommandEvent, @ResponseArg response: Response, @RestArguments(true, {join: " "}) message: string): Promise<void> {
        return  response.rawMessage(">> " + message);
    }
}

class EvalCommand extends Command {
    constructor() {
        super("eval", "<expression>");
    }

    @CommandHandler("eval", "eval <expression>")
    @CheckPermission("general.eval")
    async handleCommand(
        event: CommandEvent, @ResponseArg response: Response, @MessageArg msg: Message,
        @RestArguments(true, {join: " "}) rawExpr: string
    ): Promise<void> {
        await response.rawMessage(">> " + await msg.evaluateExpression(rawExpr));
    }
}

class ShutdownCommand extends Command {
    constructor() {
        super("shutdown", null);
    }

    @CommandHandler("shutdown", "shutdown")
    @CheckPermission("general.shutdown")
    async handleCommand(event: CommandEvent, @ResponseArg response: Response): Promise<void> {
        await response.broadcast(array_rand(await response.getTranslation<string[]>("shutdown")));
        Bot.LOGGER.info("Shutting down...");
        process.exit();
    }
}

export default class GeneralModule extends AbstractModule {
    static [Symbols.ModuleInfo] = MODULE_INFO;

    constructor() {
        super(GeneralModule);

        this.coreModule = true;
    }

    @command pingCommand = new PingCommand();
    @command rawCommand = new RawCommand();
    @command echoCommand = new EchoCommand();
    @command evalCommand = new EvalCommand();
    @command shutdownCommand = new ShutdownCommand();

    @permission ping = new Permission("general.ping", Role.MODERATOR);
    @permission raw = new Permission("general.raw", Role.OWNER);
    @permission echo = new Permission("general.echo", Role.MODERATOR);
    @permission evalPerm = new Permission("general.eval", Role.MODERATOR);
    @permission shutdown = new Permission("general.shutdown", Role.OWNER);

    @setting timezone = new Setting("timezone", moment.tz.zone("America/New_York"), SettingType.TIMEZONE);

    @ExpressionContextResolver
    expressionContextResolver(msg: Message): ExpressionContext {
        return {
            datetime: validateFunction(async (format: string = "Y-m-d h:i:s"): Promise<string> => {
                const timezone = await msg.getChannel().getSetting(this.timezone);
                return moment().tz(timezone.name).format(format);
            }, ["string"], returnErrorAsync())
        }
    }
}