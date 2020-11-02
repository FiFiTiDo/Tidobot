import AbstractModule, {Symbols} from "./AbstractModule";
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
import Message from "../Chat/Message";
import {ExpressionContext} from "../Systems/Expressions/ExpressionSystem";
import {CommandHandler} from "../Systems/Commands/Validation/CommandHandler";
import CheckPermission from "../Systems/Commands/Validation/CheckPermission";
import {Argument, ChannelArg, MessageArg, ResponseArg} from "../Systems/Commands/Validation/Argument";
import {Response} from "../Chat/Response";
import {logWarningOnFail, validateFunction} from "../Utilities/ValidateFunction";
import { Service } from "typedi";
import { Channel } from "../Database/Entities/Channel";
import { Permission as PermissionEntity } from "../Database/Entities/Permission";
import { PermissionRepository } from "../Database/Repositories/PermissionRepository";
import { InjectRepository } from "typeorm-typedi-extensions";

export const MODULE_INFO = {
    name: "Permission",
    version: "1.2.0",
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

export const PermissionArg = new EntityArg(PermissionRepository, {msgKey: "permission:error.unknown", optionKey: "permission"});

@Service()
class PermissionCommand extends Command {
    constructor(
        private readonly permissionSystem: PermissionSystem, 
        @InjectRepository() private readonly permissionRepository: PermissionRepository
    ) {
        super("permission", "<create|delete|set|reset>", ["perm"]);
    }

    @CommandHandler(/^perm(ission)? create/, "permission create <permission token> <default role>", 1)
    @CheckPermission(() => PermissionModule.permissions.createPerm)
    async create(
        event: CommandEvent, @ResponseArg response: Response, @MessageArg msg: Message, @ChannelArg channel: Channel,
        @Argument(StringArg, "permission token") token: string, @Argument(RoleArg, "default role") role: Role
    ): Promise<void> {
        if (await this.permissionRepository.count({ channel, token }) > 0) return response.message("permission:error.already-exists");
        return this.permissionRepository
            .create({channel, token, role, defaultRole: role, moduleDefined: false}).save()
            .then(() => response.message("permission:created", {permission: token, role: Role[role]}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^perm(ission)? del(ete)?/, "permission delete <permission>", 1)
    @CheckPermission(() => PermissionModule.permissions.deletePerm)
    async delete(
        event: CommandEvent, @ResponseArg response: Response, @Argument(PermissionArg) permission: PermissionEntity
    ): Promise<void> {
        if (permission.moduleDefined)
            return response.message("permission:error.module-defined", {permission: permission.token});
        return permission.remove()
            .then(() => response.message("permission:deleted", {permission: permission.token}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^perm(ission)? set/, "permission set <permission> <role>", 1)
    @CheckPermission(() => PermissionModule.permissions.setPerm)
    async set(
        event: CommandEvent, @ResponseArg response: Response, @MessageArg msg: Message,
        @Argument(PermissionArg) permission: PermissionEntity, @Argument(RoleArg) role: Role
    ): Promise<void> {
        if (!(await msg.checkPermission(permission.token)))
            return response.message("permission:error.not-permitted");
        permission.role = role;
        permission.save()
            .then(() => response.message("permission:set", {permission: permission.token, role: Role[role]}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^perm(ission)? reset (.+)$/, "permission reset <permission>", 1)
    @CheckPermission(() => PermissionModule.permissions.resetPerm)
    async reset(
        event: CommandEvent, @ResponseArg response: Response, @MessageArg msg: Message,
        @Argument(PermissionArg, "permission") permission: PermissionEntity = null
    ): Promise<void> {
        if (!(await msg.checkPermission(permission.token)))
            return response.message("permission:error.not-permitted");
        permission.role = permission.defaultRole;
        return permission.save()
            .then(() => response.message("permissions:reset", {permission: permission.token}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^perm(ission)? reset$/, "permission reset")
    @CheckPermission(() => PermissionModule.permissions.resetAllPerms)
    async resetAll(event: CommandEvent, @ResponseArg response: Response, @ChannelArg channel: Channel): Promise<void> {
        return this.permissionSystem.resetChannelPermissions(channel)
            .then(() => response.message("permission:reset-all"))
            .catch(e => response.genericErrorAndLog(e, logger));
    }
}

@HandlesEvents()
@Service()
export default class PermissionModule extends AbstractModule {
    static [Symbols.ModuleInfo] = MODULE_INFO;
    static permissions = {
        createPerm: new Permission("permission.create", Role.MODERATOR),
        deletePerm: new Permission("permission.delete", Role.MODERATOR),
        setPerm: new Permission("permission.set", Role.MODERATOR),
        grantPerm: new Permission("permission.grant", Role.MODERATOR),
        denyPerm: new Permission("permission.deny", Role.MODERATOR),
        resetPerm: new Permission("permission.reset", Role.MODERATOR),
        resetAllPerms: new Permission("permission.reset.all", Role.BROADCASTER)
    }

    constructor(permissionCommand: PermissionCommand, private readonly permissionSystem: PermissionSystem) {
        super(PermissionModule);

        this.coreModule = true;
        this.registerCommand(permissionCommand);
        this.registerPermissions(PermissionModule.permissions);
        this.registerExpressionContextResolver(this.expressionContextResolver);
    }

    expressionContextResolver(msg: Message): ExpressionContext {
        return {
            sender: {
                isA: validateFunction(
                    async (role: Role) => getMaxRole(await msg.getUserRoles()) >= role, 
                    ["role|required"], logWarningOnFail(logger, Promise.resolve(false))
                ),
                can: validateFunction(
                    async (permission: string) => msg.checkPermission(permission),
                    ["string|required"], logWarningOnFail(logger, Promise.resolve(false))
                )
            }
        };
    }

    @EventHandler(NewChannelEvent)
    async onNewChannel({channel}: NewChannelEventArgs): Promise<void> {
        await this.permissionSystem.resetChannelPermissions(channel);
    }
}