import AbstractModule, {ModuleInfo, Systems} from "./AbstractModule";
import moment from "moment-timezone";
import {array_rand, tuple} from "../Utilities/ArrayUtils";
import Permission from "../Systems/Permissions/Permission";
import {Role} from "../Systems/Permissions/Role";
import Setting, {SettingType} from "../Systems/Settings/Setting";
import Command from "../Systems/Commands/Command";
import {CommandEventArgs} from "../Systems/Commands/CommandEvent";
import {string} from "../Systems/Commands/Validator/String";
import StandardValidationStrategy from "../Systems/Commands/Validator/Strategies/StandardValidationStrategy";
import {ValidatorStatus} from "../Systems/Commands/Validator/Strategies/ValidationStrategy";
import Bot from "../Application/Bot";

export const MODULE_INFO = {
    name: "General",
    version: "1.0.0",
    description: "General bot commands that don't fit in other modules"
};

class PingCommand extends Command {
    constructor() {
        super("ping", null);
    }

    async execute({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {status} = await event.validate(new StandardValidationStrategy({
            usage: "ping",
            permission: "general.ping"
        }));
         if (status !== ValidatorStatus.OK) return;

        await response.message("pong", {username: msg.getChatter().name});
    }
}

class RawCommand extends Command {
    constructor() {
        super("raw", "<text>");
    }

    async execute({event, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "raw <text>",
            arguments: tuple(
                string({ name: "text", required: true, greedy: true })
            ),
            permission: "general.raw"
        }));
         if (status !== ValidatorStatus.OK) return;
        const [value] = args;

        await response.rawMessage(value);
    }
}

class EchoCommand extends Command {
    constructor() {
        super("echo", "<message>");
    }

    async execute({event, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "echo <message>",
            arguments: tuple(
                string({ name: "message", required: true, greedy: true })
            ),
            permission: "general.echo"
        }));
         if (status !== ValidatorStatus.OK) return;
        const [message] = args;

        await response.rawMessage(">> " + message);
    }
}

class EvalCommand extends Command {
    constructor() {
        super("eval", "<expression>");
    }

    async execute({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "eval <expression>",
            arguments: tuple(
                string({ name: "expression", required: true, greedy: true })
            ),
            permission: "general.eval"
        }));
         if (status !== ValidatorStatus.OK) return;
        const [rawExpr] = args;

        await response.rawMessage(">> " + await msg.evaluateExpression(rawExpr));
    }
}

class ShutdownCommand extends Command {
    constructor() {
        super("shutdown", null);
    }

    async execute({event, response}: CommandEventArgs): Promise<void> {
        const {status} = await event.validate(new StandardValidationStrategy({
            usage: "shutdown",
            permission: "general.shutdown"
        }));
         if (status !== ValidatorStatus.OK) return;

        await response.broadcast(array_rand(await response.getTranslation("shutdown")));
        Bot.LOGGER.info("Shutting down...");
        process.exit();
    }
}

export default class GeneralModule extends AbstractModule {
    constructor() {
        super(GeneralModule.name);

        this.coreModule = true;
    }

    initialize({ command, permission, settings, expression }: Systems): ModuleInfo {
        command.registerCommand(new PingCommand(), this);
        command.registerCommand(new RawCommand(), this);
        command.registerCommand(new EchoCommand(), this);
        command.registerCommand(new EvalCommand(), this);
        command.registerCommand(new ShutdownCommand(), this);
        permission.registerPermission(new Permission("general.ping", Role.MODERATOR));
        permission.registerPermission(new Permission("general.raw", Role.OWNER));
        permission.registerPermission(new Permission("general.echo", Role.MODERATOR));
        permission.registerPermission(new Permission("general.eval", Role.MODERATOR));
        permission.registerPermission(new Permission("general.shutdown", Role.OWNER));
        settings.registerSetting(new Setting("timezone", "America/New_York", SettingType.TIMEZONE));
        expression.registerResolver(msg => ({
            datetime: async (format = "Y-m-d h:i:s"): Promise<string> => {
                const timezone = await msg.getChannel().getSetting<moment.MomentZone>("timezone");
                return moment().tz(timezone.name).format(format);
            }
        }));

        return MODULE_INFO;
    }
}