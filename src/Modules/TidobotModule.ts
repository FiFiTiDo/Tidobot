import AbstractModule from "./AbstractModule";
import {Key} from "../Utilities/Translator";
import ChatterEntity from "../Database/Entities/ChatterEntity";
import PermissionSystem from "../Systems/Permissions/PermissionSystem";
import Permission from "../Systems/Permissions/Permission";
import {Role} from "../Systems/Permissions/Role";
import Logger from "../Utilities/Logger";
import UserEntity from "../Database/Entities/UserEntity";
import Command from "../Systems/Commands/Command";
import {CommandEventArgs} from "../Systems/Commands/CommandEvent";
import CommandSystem from "../Systems/Commands/CommandSystem";

class TidobotCommand extends Command {
    constructor() {
        super("tidobot", "<version|about||ban|unban>");

        this.addSubcommand("version", this.version);
        this.addSubcommand("ver", this.version);
        this.addSubcommand("about", this.about);
        this.addSubcommand("ignore", this.ignore);
        this.addSubcommand("unignore", this.unignore);
        this.addSubcommand("ban", this.ban);
        this.addSubcommand("unban", this.unban);
    }

    async version({event, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "tidobot version",
            permission: "bot.version"
        });
        if (args === null) return;

        await response.message("Tidobot v" + process.env.BOT_VERSION);
    }

    async about({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "tidobot about",
            permission: "bot.about"
        });
        if (args === null) return;

        await response.message("Hi, " + msg.getChatter().name + "! My name is tidobot, I'm your friendly neighborhood robot here to enhance your chatting experience! To learn more visit https://www.fifitido.net/tidobot/");
    }

    async ignore({event, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "tidobot ignore <user>",
            arguments: [
                {
                    value: {
                        type: "user",
                    },
                    required: true
                }
            ],
            permission: "bot.ignore.add"
        });
        if (args === null) return;
        const user = args[0] as UserEntity;
        if (user.ignore) return response.message(Key("general.ignore.add.already_ignored"), user.name);
        user.ignore = true;
        user.save()
            .then(() => response.message(Key("general.ignore.add.successful"), user.name))
            .catch(e => {
                Logger.get().error("Failed to set a user as ignored", {cause: e});
                return response.message(Key("general.ignore.add.failed"), user.name);
            });
    }

    async unignore({event, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "tidobot unignore <user>",
            arguments: [
                {
                    value: {
                        type: "user",
                    },
                    required: true
                }
            ],
            permission: "bot.ignore.remove"
        });
        if (args === null) return;
        const user = args[0] as UserEntity;
        if (!user.ignore) return response.message(Key("general.ignore.remove.not_ignored"), user.name);
        user.ignore = false;
        user.save()
            .then(() => response.message(Key("general.ignore.remove.successful"), user.name))
            .catch(e => {
                Logger.get().error("Failed to set a user as not ignored", {cause: e});
                return response.message(Key("general.ignore.remove.failed"), user.name);
            });
    }

    async ban({event, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "tidobot ban <user>",
            arguments: [
                {
                    value: {
                        type: "chatter",
                    },
                    required: true
                }
            ],
            permission: "bot.ban"
        });
        if (args === null) return;
        const [user] = args as [ChatterEntity];
        if (user.banned) return response.message(Key("general.ban.add.already_banned"), user.name);
        user.banned = true;
        user.save()
            .then(() => response.message(Key("general.ban.add.successful"), user.name))
            .catch(e => {
                Logger.get().error("Failed to set a user as banned", {cause: e});
                return response.message(Key("general.ban.add.failed"), user.name);
            });
    }

    async unban({event, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "tidobot unban <user>",
            arguments: [
                {
                    value: {
                        type: "chatter",
                    },
                    required: true
                }
            ],
            permission: "bot.unban"
        });
        if (args === null) return;
        const [user] = args as [ChatterEntity];
        if (!user.banned) return response.message(Key("general.ban.remove.not_banned"), user.name);
        user.banned = false;
        user.save()
            .then(() => response.message(Key("general.ban.remove.successful"), user.name))
            .catch(e => {
                Logger.get().error("Failed to unset a user as unbanned", {cause: e});
                return response.message(Key("general.ban.remove.failed"), user.name);
            });
    }
}

class RegularCommand extends Command {
    constructor() {
        super("regular", "<add|remove>", ["reg"]);

        this.addSubcommand("add", this.addRegular);
        this.addSubcommand("remove", this.removeRegular);
        this.addSubcommand("rem", this.removeRegular);
    }

    async addRegular({event, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "regular add <user>",
            arguments: [
                {
                    value: {
                        type: "chatter",
                    },
                    required: true
                }
            ],
            permission: "regular.add"
        });
        if (args === null) return;
        const [user] = args as [ChatterEntity];
        if (user.regular) return response.message(Key("general.regular.add.already_a_regular"), user.name);
        user.regular = true;
        user.save()
            .then(() => response.message(Key("general.regular.add.successful"), user.name))
            .catch(e => {
                Logger.get().error("Failed to set a user as regular", { cause: e });
                return response.message(Key("general.regular.add.failed"), user.name);
            });
    }

    async removeRegular({event, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "regular remove <user>",
            arguments: [
                {
                    value: {
                        type: "chatter",
                    },
                    required: true
                }
            ],
            permission: "regular.remove"
        });
        if (args === null) return;
        const [user] = args as [ChatterEntity];
        if (!user.regular) return response.message(Key("general.regular.remove.not_a_regular"), user.name);
        user.regular = false;
        user.save()
            .then(() => response.message(Key("general.regular.remove.successful"), user.name))
            .catch(e => {
                Logger.get().error("Failed to unset a user as regular", { cause: e });
                return response.message(Key("general.regular.remove.failed"), user.name);
            });
    }
}

export default class TidobotModule extends AbstractModule {
    constructor() {
        super(TidobotModule.name);

        this.coreModule = true;
    }

    initialize(): void {
        const perm = PermissionSystem.getInstance();
        perm.registerPermission(new Permission("bot.version", Role.NORMAL));
        perm.registerPermission(new Permission("bot.about", Role.NORMAL));
        perm.registerPermission(new Permission("bot.ignore.add", Role.OWNER));
        perm.registerPermission(new Permission("bot.ignore.remove", Role.OWNER));
        perm.registerPermission(new Permission("bot.ban", Role.BROADCASTER));
        perm.registerPermission(new Permission("bot.unban", Role.BROADCASTER));

        perm.registerPermission(new Permission("regular.add", Role.MODERATOR));
        perm.registerPermission(new Permission("regular.remove", Role.MODERATOR));

        const cmd = CommandSystem.getInstance();
        cmd.registerCommand(new TidobotCommand(), this);
        cmd.registerCommand(new RegularCommand(), this);
    }
}