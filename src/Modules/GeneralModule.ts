import AbstractModule from "./AbstractModule";
import moment from "moment-timezone";
import {array_rand} from "../Utilities/ArrayUtils";
import {Key} from "../Utilities/Translator";
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

class PingCommand extends Command {
    constructor() {
        super("ping", null);
    }

    async execute({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "ping",
            permission: "general.ping"
        });
        if (args === null) return;

        await response.message(Key("general.pong"), msg.getChatter().name);
    }
}

class RawCommand extends Command {
    constructor() {
        super("raw", "<text>");
    }

    async execute({event, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "raw",
            arguments: [
                {
                    value: {
                        type: "string",
                    },
                    required: true,
                    greedy: true
                }
            ],
            permission: "general.raw"
        });
        if (args === null) return;
        const [value] = args;

        await response.message(value);
    }
}

class EchoCommand extends Command {
    constructor() {
        super("echo", "<message>");
    }

    async execute({event, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "echo <expression>",
            arguments: [
                {
                    value: {
                        type: "string",
                    },
                    required: true,
                    greedy: true
                }
            ],
            permission: "general.echo"
        });
        if (args === null) return;
        const [message] = args;

        await response.message(">> " + message);
    }
}

class EvalCommand extends Command {
    constructor() {
        super("eval", "<expression>");
    }

    async execute({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "eval <expression>",
            arguments: [
                {
                    value: {
                        type: "string",
                    },
                    required: true,
                    greedy: true
                }
            ],
            permission: "general.eval"
        });
        if (args === null) return;
        const [rawExpr] = args;

        try {
            await response.message(">> " +  await msg.evaluateExpression(rawExpr));
        } catch (e) {
            Logger.get().error("Unable to evaluate expression " + rawExpr, {cause: e});
            await response.message(Key("general.failed_to_eval"));
        }
    }
}

class ShutdownCommand extends Command {
    constructor() {
        super("shutdown", null);
    }

    async execute({event, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "shutdown",
            permission: "general.shutdown"
        });
        if (args === null) return;

        await response.broadcast(array_rand(response.getTranslation(Key("general.shutdown"))));
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
            datetime: async (format?: string): Promise<string> => {
                const timezone = await msg.getChannel().getSetting<moment.MomentZone>("timezone");
                return moment().tz(timezone.name).format(format ? format : "Y-m-d h:i:s");
            }
        }));
    }
}