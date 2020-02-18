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

export default class TidobotModule extends AbstractModule {
    constructor() {
        super(TidobotModule.name);

        this.coreModule = true;
    }

    initialize() {
        const cmd = this.getModuleManager().getModule(CommandModule);
        const perm = this.getModuleManager().getModule(PermissionModule);

        perm.registerPermission("bot.version", PermissionLevel.NORMAL);
        perm.registerPermission("bot.about", PermissionLevel.NORMAL);
        perm.registerPermission("bot.ignore.add", PermissionLevel.OWNER);
        perm.registerPermission("bot.ignore.remove", PermissionLevel.OWNER);
        perm.registerPermission("bot.ban", PermissionLevel.BROADCASTER);
        perm.registerPermission("bot.unban", PermissionLevel.BROADCASTER);

        perm.registerPermission("regular.add", PermissionLevel.MODERATOR);
        perm.registerPermission("regular.remove", PermissionLevel.MODERATOR);

        cmd.registerCommand("tidobot", this.tidobotCmd, this);
        cmd.registerCommand("regular", this.regularCommand, this);
        cmd.registerCommand("reg", this.regularCommand, this);
    }

    async tidobotCmd(event: CommandEvent) {
        new SubcommandHelper.Builder()
            .addSubcommand("version", this.version)
            .addSubcommand("ver", this.version)
            .addSubcommand("about", this.about)
            .addSubcommand("ignore", this.ignore)
            .addSubcommand("unignore", this.unignore)
            .addSubcommand("ban", this.ban)
            .addSubcommand("unban", this.unban)
            .showUsageOnDefault("tidobot <version|about>")
            .build(this)
            .handle(event);
    }

    async version(event: CommandEvent) {
        let msg = event.getMessage();
        let args = await event.validate({
            usage: "tidobot version",
            permission: "bot.version"
        });
        if (args === null) return;

        let version = Application.getConfig().get("general.version");
        await msg.reply("Tidobot v" + version);
    };

    async about(event: CommandEvent) {
        let msg = event.getMessage();
        let args = await event.validate({
            usage: "tidobot about",
            permission: "bot.about"
        });
        if (args === null) return;

        await msg.reply("Hi, " + msg.getChatter().getName() + "! My name is tidobot, I'm your friendly neighborhood robot here to enhance your chatting experience! To learn more visit https://www.fifitido.net/tidobot/");
    };

    async ignore(event: CommandEvent) {
        let msg = event.getMessage();
        let args = await event.validate({
            usage: "tidobot ignore <user>",
            arguments: [
                {
                    type: "string",
                    required: true,
                },
                {
                    type: "user",
                    required: true
                }
            ],
            permission: "bot.ignore.add"
        });
        if (args === null) return;
        let user = args[1] as User;
        if (user.isIgnored()) return msg.reply(__("general.ignore.add.already_ignored", user.getName()));
        user.setIgnore(true)
            .then(() => msg.reply(__("general.ignore.add.successful", user.getName())))
            .catch(e => {
                Application.getLogger().error("Failed to set a user as ignored", { cause: e });
                return msg.reply(__("general.ignore.add.failed", user.getName()))
            })
    }

    async unignore(event: CommandEvent) {
        let msg = event.getMessage();
        let args = await event.validate({
            usage: "tidobot unignore <user>",
            arguments: [
                {
                    type: "string",
                    required: true,
                },
                {
                    type: "user",
                    required: true
                }
            ],
            permission: "bot.ignore.remove"
        });
        if (args === null) return;
        let user = args[1] as User;
        if (!user.isIgnored()) return msg.reply(__("general.ignore.remove.not_ignored", user.getName()));
        user.setIgnore(true)
            .then(() => msg.reply(__("general.ignore.remove.successful", user.getName())))
            .catch(e => {
                Application.getLogger().error("Failed to set a user as not ignored", { cause: e });
                return msg.reply(__("general.ignore.remove.failed", user.getName()))
            })
    }

    async ban(event: CommandEvent) {
        let msg = event.getMessage();
        let args = await event.validate({
            usage: "tidobot ban <user>",
            arguments: [
                {
                    type: "string",
                    required: true
                },
                {
                    type: "chatter",
                    required: true
                }
            ],
            permission: "bot.ban"
        });
        if (args === null) return;
        let user = args[1] as Chatter;
        if (user.isBanned()) return msg.reply(__("general.ban.add.already_banned", user.getName()));
        user.setBanned(true)
            .then(() => msg.reply(__("general.ban.add.successful", user.getName())))
            .catch(e => {
                Application.getLogger().error("Failed to set a user as banned", { cause: e });
                return msg.reply(__("general.ban.add.failed", user.getName()))
            })
    }

    async unban(event: CommandEvent) {
        let msg = event.getMessage();
        let args = await event.validate({
            usage: "tidobot unban <user>",
            arguments: [
                {
                    type: "string",
                    required: true
                },
                {
                    type: "chatter",
                    required: true
                }
            ],
            permission: "bot.unban"
        });
        if (args === null) return;
        let user = args[1] as Chatter;
        if (!user.isBanned()) return msg.reply(__("general.ban.remove.not_banned", user.getName()));
        user.setBanned(false)
            .then(() => msg.reply(__("general.ban.remove.successful", user.getName())))
            .catch(e => {
                Application.getLogger().error("Failed to unset a user as unbanned", { cause: e });
                return msg.reply(__("general.ban.remove.failed", user.getName()))
            })
    }

    regularCommand(event: CommandEvent) {
        new SubcommandHelper.Builder()
            .addSubcommand("add", this.addRegular)
            .addSubcommand("remove", this.removeRegular)
            .addSubcommand("rem", this.removeRegular)
            .showUsageOnDefault("regular <add|remove>")
            .build(this)
            .handle(event);
    }

    async addRegular(event: CommandEvent) {
        let msg = event.getMessage();
        let args = await event.validate({
            usage: "regular add <user>",
            arguments: [
                {
                    type: "string",
                    required: true
                },
                {
                    type: "chatter",
                    required: true
                }
            ],
            permission: "regular.add"
        });
        if (args === null) return;
        let user = args[1] as Chatter;
        if (user.isRegular()) return msg.reply(__("general.regular.add.already_a_regular", user.getName()));
        user.setRegular(true)
            .then(() => msg.reply(__("general.regular.add.successful", user.getName())))
            .catch(e => {
                Application.getLogger().error("Failed to set a user as regular", { cause: e });
                return msg.reply(__("general.regular.add.failed", user.getName()))
            })
    }

    async removeRegular(event: CommandEvent) {
        let msg = event.getMessage();
        let args = await event.validate({
            usage: "regular remove <user>",
            arguments: [
                {
                    type: "string",
                    required: true
                },
                {
                    type: "chatter",
                    required: true
                }
            ],
            permission: "regular.remove"
        });
        if (args === null) return;
        let user = args[1] as Chatter;
        if (!user.isRegular()) return msg.reply(__("general.regular.remove.not_a_regular", user.getName()));
        user.setRegular(false)
            .then(() => msg.reply(__("general.regular.remove.successful", user.getName())))
            .catch(e => {
                Application.getLogger().error("Failed to unset a user as regular", { cause: e });
                return msg.reply(__("general.regular.remove.failed", user.getName()))
            })
    }
}