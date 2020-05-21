import AbstractModule from "./AbstractModule";
import ChatterEntity from "../Database/Entities/ChatterEntity";
import PermissionSystem from "../Systems/Permissions/PermissionSystem";
import Permission from "../Systems/Permissions/Permission";
import {Role} from "../Systems/Permissions/Role";
import Logger from "../Utilities/Logger";
import IgnoredEntity from "../Database/Entities/IgnoredEntity";
import Command from "../Systems/Commands/Command";
import {CommandEventArgs} from "../Systems/Commands/CommandEvent";
import CommandSystem from "../Systems/Commands/CommandSystem";
import {chatter as chatterConverter} from "../Systems/Commands/Validator/Chatter";
import {ValidatorStatus} from "../Systems/Commands/Validator/Strategies/ValidationStrategy";
import StandardValidationStrategy from "../Systems/Commands/Validator/Strategies/StandardValidationStrategy";
import {tuple} from "../Utilities/ArrayUtils";

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
        const {status} = await event.validate(new StandardValidationStrategy({
            usage: "tidobot version",
            permission: "bot.version"
        }));
         if (status !== ValidatorStatus.OK) return;

        await response.message("Tidobot v" + process.env.BOT_VERSION);
    }

    async about({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {status} = await event.validate(new StandardValidationStrategy({
            usage: "tidobot about",
            permission: "bot.about"
        }));
         if (status !== ValidatorStatus.OK) return;

        await response.message("Hi, " + msg.getChatter().name + "! My name is tidobot, I'm your friendly neighborhood robot here to enhance your chatting experience! To learn more visit https://www.fifitido.net/tidobot/");
    }

    async ignore({event, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "tidobot ignore <user>",
            arguments: tuple(
                chatterConverter({ name: "user", required: true })
            ),
            permission: "bot.ignore.add"
        }));
         if (status !== ValidatorStatus.OK) return;
        const chatter = args[0] as ChatterEntity;
        IgnoredEntity.add(chatter.getService(), chatter.userId)
            .then(ignored => response.message(ignored ? "user:ignore.added" : "user:ignore.already", {username: chatter.name}))
            .catch(e => {
                Logger.get().error("Failed to set a user as ignored", {cause: e});
                return response.genericError();
            });
    }

    async unignore({event, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "tidobot unignore <user>",
            arguments: tuple(
                chatterConverter({ name: "user", required: true })
            ),
            permission: "bot.ignore.remove"
        }));
         if (status !== ValidatorStatus.OK) return;
        const chatter = args[0] as ChatterEntity;
        IgnoredEntity.remove(chatter.getService(), chatter.userId)
            .then(ignored => response.message(ignored ? "user:ignore.removed" : "user:ignore.not", {username: chatter.name}))
            .catch(e => {
                Logger.get().error("Failed to set a user as not ignored", {cause: e});
                return response.genericError();
            });
    }

    async ban({event, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "tidobot ban <user>",
            arguments: tuple(
                chatterConverter({ name: "user", required: true })
            ),
            permission: "bot.ban"
        }));
         if (status !== ValidatorStatus.OK) return;
        const [user] = args;
        if (user.banned) return response.message("user:ban.already", {username: user.name});
        user.banned = true;
        user.save()
            .then(() => response.message("user:ban.added", {username: user.name}))
            .catch(e => {
                Logger.get().error("Failed to set a user as banned", {cause: e});
                return response.genericError();
            });
    }

    async unban({event, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "tidobot unban <user>",
            arguments: tuple(
                chatterConverter({ name: "user", required: true })
            ),
            permission: "bot.unban"
        }));
         if (status !== ValidatorStatus.OK) return;
        const [user] = args;
        if (!user.banned) return response.message("user:ban.not", {username: user.name});
        user.banned = false;
        user.save()
            .then(() => response.message("user:ban.removed", {username: user.name}))
            .catch(e => {
                Logger.get().error("Failed to unset a user as unbanned", {cause: e});
                return response.genericError();
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
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "regular add <user>",
            arguments: tuple(
                chatterConverter({ name: "user", required: true })
            ),
            permission: "regular.add"
        }));
         if (status !== ValidatorStatus.OK) return;
        const [user] = args;
        if (user.regular) return response.message("user:regular.already", {username: user.name});
        user.regular = true;
        user.save()
            .then(() => response.message("user:regular.added", {username: user.name}))
            .catch(e => {
                Logger.get().error("Failed to set a user as regular", {cause: e});
                return response.genericError();
            });
    }

    async removeRegular({event, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "regular remove <user>",
            arguments: tuple(
                chatterConverter({ name: "user", required: true })
            ),
            permission: "regular.remove"
        }));
         if (status !== ValidatorStatus.OK) return;
        const [user] = args;
        if (!user.regular) return response.message("user:regular.not", {username: user.name});
        user.regular = false;
        user.save()
            .then(() => response.message("user:regular.removed", {username: user.name}))
            .catch(e => {
                Logger.get().error("Failed to unset a user as regular", {cause: e});
                return response.genericError();
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