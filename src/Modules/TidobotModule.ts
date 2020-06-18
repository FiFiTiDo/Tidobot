import AbstractModule, {Symbols} from "./AbstractModule";
import ChatterEntity from "../Database/Entities/ChatterEntity";
import Permission from "../Systems/Permissions/Permission";
import {Role} from "../Systems/Permissions/Role";
import IgnoredEntity from "../Database/Entities/IgnoredEntity";
import Command from "../Systems/Commands/Command";
import {CommandEventArgs} from "../Systems/Commands/CommandEvent";
import {chatter as chatterConverter} from "../Systems/Commands/Validator/Chatter";
import {ValidatorStatus} from "../Systems/Commands/Validator/Strategies/ValidationStrategy";
import StandardValidationStrategy from "../Systems/Commands/Validator/Strategies/StandardValidationStrategy";
import {tuple} from "../Utilities/ArrayUtils";
import Config from "../Systems/Config/Config";
import GeneralConfig from "../Systems/Config/ConfigModels/GeneralConfig";
import {getLogger} from "../Utilities/Logger";
import {command, Subcommand} from "../Systems/Commands/decorators";
import {permission} from "../Systems/Permissions/decorators";
import {version} from "../../package.json";

export const MODULE_INFO = {
    name: "Tidobot",
    version: "1.0.2",
    description: "Used to manage core bot functionality other than settings and get more info"
};

const logger = getLogger(MODULE_INFO.name);

class TidobotCommand extends Command {
    constructor(private readonly tidobotModule: TidobotModule) {
        super("tidobot", "<version|about||ban|unban>");
    }

    @Subcommand("version", "ver")
    async version({event, response}: CommandEventArgs): Promise<void> {
        const {status} = await event.validate(new StandardValidationStrategy({
            usage: "tidobot version",
            subcommand: "version",
            permission: this.tidobotModule.viewBotVersion
        }));
         if (status !== ValidatorStatus.OK) return;
        await response.message("Tidobot v" + version);
    }

    @Subcommand("about")
    async about({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {status} = await event.validate(new StandardValidationStrategy({
            usage: "tidobot about",
            subcommand: "about",
            permission: this.tidobotModule.viewBotInfo
        }));
         if (status !== ValidatorStatus.OK) return;

        await response.message("Hi, " + msg.getChatter().name + "! My name is tidobot, I'm your friendly neighborhood robot here to enhance your chatting experience! To learn more visit https://www.fifitido.net/tidobot/");
    }

    @Subcommand("ignore")
    async ignore({event, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "tidobot ignore <user>",
            subcommand: "ignore",
            arguments: tuple(
                chatterConverter({ name: "user", required: true })
            ),
            permission: this.tidobotModule.addIgnored
        }));
         if (status !== ValidatorStatus.OK) return;
        const chatter = args[0] as ChatterEntity;
        IgnoredEntity.add(chatter.getService(), chatter.userId)
            .then(ignored => response.message(ignored ? "user:ignore.added" : "user:ignore.already", {username: chatter.name}))
            .catch(e => {
                logger.error("Failed to set a user as ignored");
            logger.error("Caused by: " + e.message);
            logger.error(e.stack);
                return response.genericError();
            });
    }

    @Subcommand("unignore")
    async unignore({event, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "tidobot unignore <user>",
            subcommand: "unignore",
            arguments: tuple(
                chatterConverter({ name: "user", required: true })
            ),
            permission: this.tidobotModule.removeIgnored
        }));
         if (status !== ValidatorStatus.OK) return;
        const chatter = args[0] as ChatterEntity;
        IgnoredEntity.remove(chatter.getService(), chatter.userId)
            .then(ignored => response.message(ignored ? "user:ignore.removed" : "user:ignore.not", {username: chatter.name}))
            .catch(e => {
                logger.error("Failed to set a user as not ignored");
            logger.error("Caused by: " + e.message);
            logger.error(e.stack);
                return response.genericError();
            });
    }

    @Subcommand("ban")
    async ban({event, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "tidobot ban <user>",
            subcommand: "bsn",
            arguments: tuple(
                chatterConverter({ name: "user", required: true })
            ),
            permission: this.tidobotModule.addBanned
        }));
         if (status !== ValidatorStatus.OK) return;
        const [user] = args;
        if (user.banned) return response.message("user:ban.already", {username: user.name});
        user.banned = true;
        user.save()
            .then(() => response.message("user:ban.added", {username: user.name}))
            .catch(e => {
                logger.error("Failed to set a user as banned");
            logger.error("Caused by: " + e.message);
            logger.error(e.stack);
                return response.genericError();
            });
    }

    @Subcommand("unban")
    async unban({event, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "tidobot unban <user>",
            subcommand: "unban",
            arguments: tuple(
                chatterConverter({ name: "user", required: true })
            ),
            permission: this.tidobotModule.removeBanned
        }));
         if (status !== ValidatorStatus.OK) return;
        const [user] = args;
        if (!user.banned) return response.message("user:ban.not", {username: user.name});
        user.banned = false;
        user.save()
            .then(() => response.message("user:ban.removed", {username: user.name}))
            .catch(e => {
                logger.error("Failed to unset a user as unbanned");
            logger.error("Caused by: " + e.message);
            logger.error(e.stack);
                return response.genericError();
            });
    }
}

class RegularCommand extends Command {
    constructor(private readonly tidobotModule: TidobotModule) {
        super("regular", "<add|remove>", ["reg"]);
    }

    @Subcommand("add")
    async addRegular({event, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "regular add <user>",
            subcommand: "add",
            arguments: tuple(
                chatterConverter({ name: "user", required: true })
            ),
            permission: this.tidobotModule.addRegular
        }));
         if (status !== ValidatorStatus.OK) return;
        const [user] = args;
        if (user.regular) return response.message("user:regular.already", {username: user.name});
        user.regular = true;
        user.save()
            .then(() => response.message("user:regular.added", {username: user.name}))
            .catch(e => {
                logger.error("Failed to set a user as regular");
            logger.error("Caused by: " + e.message);
            logger.error(e.stack);
                return response.genericError();
            });
    }

    @Subcommand("remove", "rem")
    async removeRegular({event, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "regular remove <user>",
            subcommand: "remove",
            arguments: tuple(
                chatterConverter({ name: "user", required: true })
            ),
            permission: this.tidobotModule.removeRegular
        }));
         if (status !== ValidatorStatus.OK) return;
        const [user] = args;
        if (!user.regular) return response.message("user:regular.not", {username: user.name});
        user.regular = false;
        user.save()
            .then(() => response.message("user:regular.removed", {username: user.name}))
            .catch(e => {
                logger.error("Failed to unset a user as regular");
            logger.error("Caused by: " + e.message);
            logger.error(e.stack);
                return response.genericError();
            });
    }
}

export default class TidobotModule extends AbstractModule {
    static [Symbols.ModuleInfo] = MODULE_INFO;

    constructor() {
        super(TidobotModule);

        this.coreModule = true;
    }

    @command tidobotCommand = new TidobotCommand(this);
    @command regularCommand = new RegularCommand(this);

    @permission viewBotVersion = new Permission("bot.version", Role.NORMAL);
    @permission viewBotInfo = new Permission("bot.about", Role.NORMAL);
    @permission addIgnored = new Permission("bot.ignore.add", Role.OWNER);
    @permission removeIgnored = new Permission("bot.ignore.remove", Role.OWNER);
    @permission addBanned = new Permission("bot.ban", Role.BROADCASTER);
    @permission removeBanned = new Permission("bot.unban", Role.BROADCASTER);
    @permission addRegular = new Permission("regular.add", Role.MODERATOR);
    @permission removeRegular = new Permission("regular.remove", Role.MODERATOR);
}