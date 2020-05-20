import AbstractModule from "./AbstractModule";
import moment from "moment-timezone";
import {array_rand} from "../Utilities/ArrayUtils";
import PermissionSystem from "../Systems/Permissions/PermissionSystem";
import Permission from "../Systems/Permissions/Permission";
import {Role} from "../Systems/Permissions/Role";
import Logger from "../Utilities/Logger";
import Setting, {SettingType} from "../Systems/Settings/Setting";
import SettingsSystem from "../Systems/Settings/SettingsSystem";
import ExpressionSystem from "../Systems/Expressions/ExpressionSystem";
import Command from "../Systems/Commands/Command";
import {CommandEventArgs} from "../Systems/Commands/CommandEvent";
import CommandSystem from "../Systems/Commands/CommandSystem";
import {string} from "../Systems/Commands/Validator/String";
import StandardValidationStrategy from "../Systems/Commands/Validator/Strategies/StandardValidationStrategy";
import {ValidatorStatus} from "../Systems/Commands/Validator/Strategies/ValidationStrategy";

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
            arguments: [
                string({ name: "text", required: true, greedy: true })
            ],
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
            arguments: [
                string({ name: "message", required: true, greedy: true })
            ],
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
            arguments: [
                string({ name: "expression", required: true, greedy: true })
            ],
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
        Logger.get().info("Shutting down...");
        process.exit();
    }
}

export default class GeneralModule extends AbstractModule {
    constructor() {
        super(GeneralModule.name);

        this.coreModule = true;
    }

    initialize(): void {
        const cmd = CommandSystem.getInstance();
        const perm = PermissionSystem.getInstance();
        const settings = SettingsSystem.getInstance();

        perm.registerPermission(new Permission("general.ping", Role.MODERATOR));
        perm.registerPermission(new Permission("general.raw", Role.OWNER));
        perm.registerPermission(new Permission("general.echo", Role.MODERATOR));
        perm.registerPermission(new Permission("general.eval", Role.MODERATOR));
        perm.registerPermission(new Permission("general.shutdown", Role.OWNER));

        cmd.registerCommand(new PingCommand(), this);
        cmd.registerCommand(new RawCommand(), this);
        cmd.registerCommand(new EchoCommand(), this);
        cmd.registerCommand(new EvalCommand(), this);
        cmd.registerCommand(new ShutdownCommand(), this);

        settings.registerSetting(new Setting("timezone", "America/New_York", SettingType.TIMEZONE));

        ExpressionSystem.getInstance().registerResolver(msg => ({
            datetime: async (format = "Y-m-d h:i:s"): Promise<string> => {
                const timezone = await msg.getChannel().getSetting<moment.MomentZone>("timezone");
                return moment().tz(timezone.name).format(format);
            }
        }));
    }
}