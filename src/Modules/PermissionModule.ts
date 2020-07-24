import AbstractModule, {Symbols} from "./AbstractModule";
import PermissionEntity from "../Database/Entities/PermissionEntity";
import {getMaxRole, parseRole, Role} from "../Systems/Permissions/Role";
import PermissionSystem from "../Systems/Permissions/PermissionSystem";
import Permission from "../Systems/Permissions/Permission";
import {NewChannelEvent, NewChannelEventArgs} from "../Chat/Events/NewChannelEvent";
import {EventHandler, HandlesEvents} from "../Systems/Event/decorators";
import Command from "../Systems/Commands/Command";
import {CommandEvent} from "../Systems/Commands/CommandEvent";
import {InvalidArgumentError} from "../Systems/Commands/Validation/ValidationErrors";
import {StringArg} from "../Systems/Commands/Validation/String";
import {EntityArg} from "../Systems/Commands/Validation/Entity";
import {getLogger} from "../Utilities/Logger";
import {command} from "../Systems/Commands/decorators";
import {permission} from "../Systems/Permissions/decorators";
import Message from "../Chat/Message";
import {ExpressionContext} from "../Systems/Expressions/ExpressionSystem";
import {ExpressionContextResolver} from "../Systems/Expressions/decorators";
import {CommandHandler} from "../Systems/Commands/Validation/CommandHandler";
import CheckPermission from "../Systems/Commands/Validation/CheckPermission";
import {Argument, Channel, MessageArg, ResponseArg} from "../Systems/Commands/Validation/Argument";
import {Response} from "../Chat/Response";
import ChannelEntity from "../Database/Entities/ChannelEntity";
import {logWarningOnFail, validateFunction} from "../Utilities/ValidateFunction";

export const MODULE_INFO = {
    name: "Permission",
    version: "1.1.1",
    description: "Change the minimum role required for predefined permissions or make your own"
};

const logger = getLogger(MODULE_INFO.name);

class RoleArg {
    static type = "role";

    static convert(input: string, name: string, column: number): Role {
        const role = parseRole(input);
        if (role === null)
            throw new InvalidArgumentError(name, "role", input, column);
        return role;
    }
}

const PermissionArg = new EntityArg(PermissionEntity, {msgKey: "permission:error.unknown", optionKey: "permission"});

class PermissionCommand extends Command {
    constructor() {
        super("permission", "<create|delete|set|reset>", ["perm"]);
    }

    @CommandHandler(/^perm(ission)? create/, "permission create <permission> <default role>", 1)
    @CheckPermission("permission.create")
    async create(
        event: CommandEvent, @ResponseArg response: Response, @MessageArg msg: Message, @Channel channel: ChannelEntity,
        @Argument(StringArg, "permission") permission: string, @Argument(RoleArg, "default role") role: Role
    ): Promise<void> {
        if (!(await msg.checkPermission(permission))) return response.message("permission:error.not-permitted");
        return PermissionEntity.make({channel}, {
            permission, role: Role[role], default_role: Role[role], module_defined: "false"
        }).then(async perm => perm === null ?
            await response.message("permission:error.already-exists") :
            await response.message("permission:created", {permission: permission, role: Role[role]})
        ).catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^perm(ission)? del(ete)?/, "permission delete <permission>", 1)
    @CheckPermission("permission.delete")
    async delete(
        event: CommandEvent, @ResponseArg response: Response, @Argument(PermissionArg) permission: PermissionEntity
    ): Promise<void> {
        if (permission.moduleDefined)
            return response.message("permission:error.module-defined", {permission: permission.permission});
        return permission.delete()
            .then(() => response.message("permission:deleted", {permission: permission.permission}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^perm(ission)? set/, "permission set <permission> <role>", 1)
    @CheckPermission("permission.set")
    async set(
        event: CommandEvent, @ResponseArg response: Response, @MessageArg msg: Message,
        @Argument(PermissionArg) permission: PermissionEntity, @Argument(RoleArg) role: Role
    ): Promise<void> {
        if (!(await msg.checkPermission(permission.permission)))
            return response.message("permission:error.not-permitted");
        permission.role = role;
        permission.save()
            .then(() => response.message("permission:set", {permission: permission.permission, role: Role[role]}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^perm(ission)? reset (.+)$/, "permission reset <permission>", 1)
    @CheckPermission("permission.reset")
    async reset(
        event: CommandEvent, @ResponseArg response: Response, @MessageArg msg: Message,
        @Argument(PermissionArg, "permission") permission: PermissionEntity = null
    ): Promise<void> {
        if (!(await msg.checkPermission(permission.permission)))
            return response.message("permission:error.not-permitted");
        permission.role = permission.defaultRole;
        return permission.save()
            .then(() => response.message("permissions:reset", {permission: permission.permission}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^perm(ission)? reset$/, "permission reset")
    @CheckPermission("permission.reset-all")
    async resetAll(event: CommandEvent, @ResponseArg response: Response, @Channel channel: ChannelEntity) {
        return PermissionSystem.getInstance().resetChannelPermissions(channel)
            .then(() => response.message("permission:reset-all"))
            .catch(e => response.genericErrorAndLog(e, logger));
    }
}

@HandlesEvents()
export default class PermissionModule extends AbstractModule {
    static [Symbols.ModuleInfo] = MODULE_INFO;
    @command permissionCommand = new PermissionCommand();
    @permission createPerm = new Permission("permission.create", Role.MODERATOR);
    @permission deletePerm = new Permission("permission.delete", Role.MODERATOR);
    @permission setPerm = new Permission("permission.set", Role.MODERATOR);
    @permission grantPerm = new Permission("permission.grant", Role.MODERATOR);
    @permission denyPerm = new Permission("permission.deny", Role.MODERATOR);
    @permission resetPerm = new Permission("permission.reset", Role.MODERATOR);
    @permission resetAllPerms = new Permission("permission.reset.all", Role.BROADCASTER);

    constructor() {
        super(PermissionModule);

        this.coreModule = true;
    }

    @ExpressionContextResolver
    expressionContextResolver(msg: Message): ExpressionContext {
        return {
            sender: {
                isA: validateFunction(async (role: Role) => {
                    return await getMaxRole(await msg.getUserRoles()) >= role;
                }, ["role|required"], logWarningOnFail(logger, Promise.resolve(false))),
                can: validateFunction(async (permission: string) => {
                    return await msg.checkPermission(permission);
                }, ["string|required"], logWarningOnFail(logger, Promise.resolve(false)))
            }
        };
    }

    @EventHandler(NewChannelEvent)
    async onNewChannel({channel}: NewChannelEventArgs): Promise<void> {
        await PermissionEntity.createTable({channel});
        await PermissionSystem.getInstance().resetChannelPermissions(channel);
    }
}