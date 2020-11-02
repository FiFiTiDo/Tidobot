import AbstractModule, {Symbols} from "./AbstractModule";
import Permission from "../Systems/Permissions/Permission";
import {Role} from "../Systems/Permissions/Role";
import Command from "../Systems/Commands/Command";
import {CommandEvent} from "../Systems/Commands/CommandEvent";
import {ChatterArg} from "../Systems/Commands/Validation/Chatter";
import {getLogger} from "../Utilities/Logger";
import {version} from "../../package.json";
import {CommandHandler} from "../Systems/Commands/Validation/CommandHandler";
import CheckPermission from "../Systems/Commands/Validation/CheckPermission";
import {Argument, ResponseArg, Sender} from "../Systems/Commands/Validation/Argument";
import {Response} from "../Chat/Response";
import {StringArg} from "../Systems/Commands/Validation/String";
import { Service } from "typedi";
import { Chatter } from "../Database/Entities/Chatter";

export const MODULE_INFO = {
    name: "Tidobot",
    version: "1.2.0",
    description: "Used to manage core bot functionality other than settings and get more info"
};

const logger = getLogger(MODULE_INFO.name);

@Service()
class TidobotCommand extends Command {
    constructor() {
        super("tidobot", "<version|about|ban|unban>");
    }

    @CommandHandler(/^(tidobot|bot|tb) ver(sion)?/, "tidobot version", 1)
    @CheckPermission(() => TidobotModule.permissions.viewBotVersion)
    async version(event: CommandEvent, @ResponseArg response: Response): Promise<void> {
        return response.message("tidobot:version", {version});
    }

    @CommandHandler(/^(tidobot|bot|tb) about/, "tidobot about [target]", 1)
    @CheckPermission(() => TidobotModule.permissions.viewBotInfo)
    async about(
        event: CommandEvent, @ResponseArg response: Response, @Sender sender: Chatter,
        @Argument(StringArg, "target", false) target: string = null
    ): Promise<void> {
        return response.message("tidobot:about", {username: target ?? sender.user.name});
    }

    @CommandHandler(/^(tidobot|bot|tb) ignore/, "tidobot ignore <user>", 1)
    @CheckPermission(() => TidobotModule.permissions.addIgnored)
    async ignore(
        event: CommandEvent, @ResponseArg response: Response, @Argument(new ChatterArg()) chatter: Chatter
    ): Promise<void> {
        if (chatter.user.ignored) return response.message("user:ignore.already", {username: chatter.user.name});
        chatter.user.ignored = true;
        return chatter.user.save()
            .then(() => response.message("user:ignore.added", {username: chatter.user.name}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^(tidobot|bot|tb) unignore/, "tidobot unignore <user>", 1)
    @CheckPermission(() => TidobotModule.permissions.removeIgnored)
    async unignore(
        event: CommandEvent, @ResponseArg response: Response, @Argument(new ChatterArg()) chatter: Chatter
    ): Promise<void> {
        if (!chatter.user.ignored) return response.message("user:ignore.not", {username: chatter.user.name});
        chatter.user.ignored = false;
        return chatter.user.save()
            .then(() => response.message("user:ignore.removed", {username: chatter.user.name}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^(tidobot|bot|tb) ban/, "tidobot ban <user>", 1)
    @CheckPermission(() => TidobotModule.permissions.addBanned)
    async ban(
        event: CommandEvent, @ResponseArg response: Response, @Argument(new ChatterArg()) chatter: Chatter
    ): Promise<void> {
        if (chatter.banned) return response.message("user:ban.already", {username: chatter.user.name});
        chatter.banned = true;
        chatter.save()
            .then(() => response.message("user:ban.added", {username: chatter.user.name}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^(tidobot|bot|tb) unban/, "tidobot unban <user>", 1)
    @CheckPermission(() => TidobotModule.permissions.removeBanned)
    async unban(
        event: CommandEvent, @ResponseArg response: Response, @Argument(new ChatterArg()) chatter: Chatter
    ): Promise<void> {
        if (!chatter.banned) return response.message("user:ban.not", {username: chatter.user.name});
        chatter.banned = false;
        chatter.save()
            .then(() => response.message("user:ban.removed", {username: chatter.user.name}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }
}

@Service()
class RegularCommand extends Command {
    constructor() {
        super("regular", "<add|remove>", ["reg"]);
    }

    @CommandHandler(/^reg(ular)? add/, "regular add <user>", 1)
    @CheckPermission(() => TidobotModule.permissions.addRegular)
    async addRegular(
        event: CommandEvent, @ResponseArg response: Response, @Argument(new ChatterArg()) chatter: Chatter
    ): Promise<void> {
        if (chatter.regular) return response.message("user:regular.already", {username: chatter.user.name});
        chatter.regular = true;
        chatter.save()
            .then(() => response.message("user:regular.added", {username: chatter.user.name}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^reg(ular)? rem(ove)?/, "regular remove <user>", 1)
    @CheckPermission(() => TidobotModule.permissions.removeRegular)
    async removeRegular(
        event: CommandEvent, @ResponseArg response: Response, @Argument(new ChatterArg()) chatter: Chatter
    ): Promise<void> {
        if (!chatter.regular) return response.message("user:regular.not", {username: chatter.user.name});
        chatter.regular = false;
        chatter.save()
            .then(() => response.message("user:regular.removed", {username: chatter.user.name}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }
}

@Service()
export default class TidobotModule extends AbstractModule {
    static [Symbols.ModuleInfo] = MODULE_INFO;
    static permissions = {
        viewBotVersion: new Permission("bot.version", Role.NORMAL),
        viewBotInfo: new Permission("bot.about", Role.NORMAL),
        addIgnored: new Permission("bot.ignore", Role.OWNER),
        removeIgnored: new Permission("bot.unignore", Role.OWNER),
        addBanned: new Permission("bot.ban", Role.BROADCASTER),
        removeBanned: new Permission("bot.unban", Role.BROADCASTER),
        addRegular: new Permission("regular.add", Role.MODERATOR),
        removeRegular: new Permission("regular.remove", Role.MODERATOR)
    }

    constructor(tidobotCommand: TidobotCommand, regularCommand: RegularCommand) {
        super(TidobotModule);

        this.coreModule = true;
        this.registerCommands(tidobotCommand, regularCommand);
    }
}