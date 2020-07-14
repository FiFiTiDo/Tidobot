import AbstractModule, {ModuleInfo, Symbols, Systems} from "./AbstractModule";
import moment from "moment-timezone";
import {array_rand, tuple} from "../Utilities/ArrayUtils";
import Permission from "../Systems/Permissions/Permission";
import {Role} from "../Systems/Permissions/Role";
import Setting, {SettingType} from "../Systems/Settings/Setting";
import Command from "../Systems/Commands/Command";
import {CommandEventArgs} from "../Systems/Commands/CommandEvent";
import {string} from "../Systems/Commands/Validation/String";
import StandardValidationStrategy from "../Systems/Commands/Validation/Strategies/StandardValidationStrategy";
import {ValidatorStatus} from "../Systems/Commands/Validation/Strategies/ValidationStrategy";
import Bot from "../Application/Bot";
import {command} from "../Systems/Commands/decorators";
import Message from "../Chat/Message";
import {ExpressionContext} from "../Systems/Expressions/ExpressionSystem";
import {ExpressionContextResolver} from "../Systems/Expressions/decorators";
import {permission} from "../Systems/Permissions/decorators";
import {setting} from "../Systems/Settings/decorators";
import {MomentZone} from "moment-timezone/moment-timezone";

export const MODULE_INFO = {
    name: "General",
    version: "1.0.2",
    description: "General bot commands that don't fit in other modules"
};

class PingCommand extends Command {
    constructor(private generalModule: GeneralModule) {
        super("ping", null);
    }

    async execute({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {status} = await event.validate(new StandardValidationStrategy({
            usage: "ping",
            permission: this.generalModule.ping
        }));
         if (status !== ValidatorStatus.OK) return;

        await response.message("pong", {username: msg.getChatter().name});
    }
}

class RawCommand extends Command {
    constructor(private generalModule: GeneralModule) {
        super("raw", "<text>");
    }

    async execute({event, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "raw <text>",
            arguments: tuple(
                string({ name: "text", required: true, greedy: true })
            ),
            permission: this.generalModule.raw
        }));
         if (status !== ValidatorStatus.OK) return;
        const [value] = args;

        await response.rawMessage(value);
    }
}

class EchoCommand extends Command {
    constructor(private generalModule: GeneralModule) {
        super("echo", "<message>");
    }

    async execute({event, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "echo <message>",
            arguments: tuple(
                string({ name: "message", required: true, greedy: true })
            ),
            permission: this.generalModule.echo
        }));
         if (status !== ValidatorStatus.OK) return;
        const [message] = args;

        await response.rawMessage(">> " + message);
    }
}

class EvalCommand extends Command {
    constructor(private generalModule: GeneralModule) {
        super("eval", "<expression>");
    }

    async execute({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "eval <expression>",
            arguments: tuple(
                string({ name: "expression", required: true, greedy: true })
            ),
            permission: this.generalModule.eval
        }));
         if (status !== ValidatorStatus.OK) return;
        const [rawExpr] = args;

        await response.rawMessage(">> " + await msg.evaluateExpression(rawExpr));
    }
}

class ShutdownCommand extends Command {
    constructor(private generalModule: GeneralModule) {
        super("shutdown", null);
    }

    async execute({event, response}: CommandEventArgs): Promise<void> {
        const {status} = await event.validate(new StandardValidationStrategy({
            usage: "shutdown",
            permission: this.generalModule.shutdown
        }));
         if (status !== ValidatorStatus.OK) return;

        await response.broadcast(array_rand(await response.getTranslation("shutdown")));
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

    @command pingCommand = new PingCommand(this);
    @command rawCommand = new RawCommand(this);
    @command echoCommand = new EchoCommand(this);
    @command evalCommand = new EvalCommand(this);
    @command shutdownCommand = new ShutdownCommand(this);

    @permission ping = new Permission("general.ping", Role.MODERATOR);
    @permission raw = new Permission("general.raw", Role.OWNER);
    @permission echo = new Permission("general.echo", Role.MODERATOR);
    @permission eval = new Permission("general.eval", Role.MODERATOR);
    @permission shutdown = new Permission("general.shutdown", Role.OWNER);

    @setting timezone = new Setting("timezone", moment.tz.zone("America/New_York"), SettingType.TIMEZONE);

    @ExpressionContextResolver
    expressionContextResolver(msg: Message): ExpressionContext {
        return {
            datetime: async (format = "Y-m-d h:i:s"): Promise<string> => {
                const timezone = await msg.getChannel().getSetting(this.timezone);
                return moment().tz(timezone.name).format(format);
            }
        }
    }
}