import AbstractModule from "./AbstractModule";
import CommandModule, {CommandEvent, SubcommandHelper} from "./CommandModule";
import PermissionModule, {PermissionLevel} from "./PermissionModule";
import Application from "../Application/Application";
import {__, __raw, array_rand} from "../Utilities/functions";
import ExpressionModule from "./ExpressionModule";
import SettingsModule from "./SettingsModule";
import {ConverterError} from "../Utilities/Converter";
import moment from "moment-timezone";
import Chatter from "../Chat/Chatter";
import User from "../Chat/User";

export default class GeneralModule extends AbstractModule {
    constructor() {
        super(GeneralModule.name);

        this.coreModule = true;
    }

    initialize() {
        const cmd = this.getModuleManager().getModule(CommandModule);
        const perm = this.getModuleManager().getModule(PermissionModule);
        const settings = this.getModuleManager().getModule(SettingsModule);

        perm.registerPermission("general.ping", PermissionLevel.MODERATOR);
        perm.registerPermission("general.raw", PermissionLevel.OWNER);
        perm.registerPermission("general.echo", PermissionLevel.MODERATOR);
        perm.registerPermission("general.eval", PermissionLevel.MODERATOR);
        perm.registerPermission("general.shutdown", PermissionLevel.OWNER);

        cmd.registerCommand("ping", this.pingCommand, this);
        cmd.registerCommand("raw", this.rawCommand, this);
        cmd.registerCommand("echo", this.echoCommand, this);
        cmd.registerCommand("eval", this.evalCommand, this);
        cmd.registerCommand("shutdown", this.shutdownCommand, this);

        settings.registerSetting("timezone", "America/New_York", (from: string): moment.MomentZone => {
            let zone = moment.tz.zone(from);
            if (zone === null)
                throw new ConverterError("timezone", from);
            return zone;
        });

        this.getModuleManager().getModule(ExpressionModule).registerResolver(msg => {
            return {
                datetime: async (format?: string) => {
                    let timezone = await msg.getChannel().getSettings().get("timezone") as moment.MomentZone;
                    return moment().tz(timezone.name).format(format ? format : "Y-m-d h:i:s");
                }
            }
        });
    }

    async pingCommand(event: CommandEvent) {
        let msg = event.getMessage();
        let args = await event.validate({
            usage: "ping",
            permission: "general.ping"
        });
        if (args === null) return;

        await msg.reply(__("general.pong", msg.getChatter().getName()));
    }

    async rawCommand(event: CommandEvent) {
        let msg = event.getMessage();
        let args = await event.validate({
            usage: "raw",
            arguments: [
                {
                    type: "string",
                    required: true,
                    greedy: true
                }
            ],
            permission: "general.raw"
        });
        if (args === null) return;
        let [value] = args;

        await msg.reply(value);
    }

    async echoCommand(event: CommandEvent) {
        let msg = event.getMessage();
        let args = await event.validate({
            usage: "echo",
            arguments: [
                {
                    type: "string",
                    required: true,
                    greedy: true
                }
            ],
            permission: "general.echo"
        });
        if (args === null) return;
        let [value] = args;

        await msg.reply(">> " + value);
    }

    async evalCommand(event: CommandEvent) {
        let msg = event.getMessage();
        let args = await event.validate({
            usage: "eval <expression>",
            arguments: [
                {
                    type: "string",
                    required: true,
                    greedy: true
                }
            ],
            permission: "general.eval"
        });
        if (args === null) return;
        let [raw_expr] = args;

        try {
            await msg.reply(">> " + await this.getModuleManager().getModule(ExpressionModule).evaluate(raw_expr, msg));
        } catch (e) {
            Application.getLogger().error("Unable to evaluate expression " + raw_expr, {cause: e});
            await msg.reply(__("general.failed_to_eval"));
        }
    }

    async shutdownCommand(event: CommandEvent) {
        let args = await event.validate({
            usage: "shutdown",
            permission: "general.shutdown"
        });
        if (args === null) return;

        Application.getChannelManager().broadcast(array_rand(__raw("general.shutdown")));
        Application.getLogger().info("Shutting down...");
        process.exit();
    }
}