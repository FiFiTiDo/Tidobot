import AbstractModule, {ModuleInfo, Symbols, Systems} from "./AbstractModule";
import PermissionEntity from "../Database/Entities/PermissionEntity";
import {getMaxRole, parseRole, Role} from "../Systems/Permissions/Role";
import PermissionSystem from "../Systems/Permissions/PermissionSystem";
import Permission from "../Systems/Permissions/Permission";
import {NewChannelEvent, NewChannelEventArgs} from "../Chat/Events/NewChannelEvent";
import {EventHandler, HandlesEvents} from "../Systems/Event/decorators";
import Command from "../Systems/Commands/Command";
import {CommandEventArgs} from "../Systems/Commands/CommandEvent";
import {onePartConverter} from "../Systems/Commands/Validation/Converter";
import {InvalidArgumentError} from "../Systems/Commands/Validation/ValidationErrors";
import {string} from "../Systems/Commands/Validation/String";
import {ValidatorStatus} from "../Systems/Commands/Validation/Strategies/ValidationStrategy";
import StandardValidationStrategy from "../Systems/Commands/Validation/Strategies/StandardValidationStrategy";
import {tuple} from "../Utilities/ArrayUtils";
import {entity} from "../Systems/Commands/Validation/Entity";
import {getLogger} from "../Utilities/Logger";
import {command, Subcommand} from "../Systems/Commands/decorators";
import {permission} from "../Systems/Permissions/decorators";
import Message from "../Chat/Message";
import {ExpressionContext} from "../Systems/Expressions/ExpressionSystem";
import {ExpressionContextResolver} from "../Systems/Expressions/decorators";

export const MODULE_INFO = {
    name: "Permission",
    version: "1.0.1",
    description: "Change the minimum role required for predefined permissions or make your own"
};

const logger = getLogger(MODULE_INFO.name);

const roleConverter = (name) => onePartConverter(name, "role", true, Role.OWNER, (part, column, message) => {
    const role = parseRole(part);
    if (role === null)
        throw new InvalidArgumentError(name, "role", part, column);
    return role;
});

class PermissionCommand extends Command {
    constructor(private readonly permissionModule: PermissionModule) {
        super("permission", "<create|delete|set|reset>", ["perm"]);
    }

    @Subcommand("create")
    async create({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "permission create <permission> <default-level>",
            subcommand: "create",
            arguments: tuple(
                string({name: "permission", required: true}),
                roleConverter("default role")
            ),
            permission: this.permissionModule.createPerm
        }));
        if (status !== ValidatorStatus.OK) return;
        const [perm_str, role] = args;

        if (!await msg.checkPermission(perm_str)) {
            await response.message("permission:error.not-permitted");
            return;
        }

        try {
            const permission = await PermissionEntity.make({channel: msg.getChannel()}, {
                permission: perm_str,
                role: Role[role],
                default_role: Role[role],
                module_defined: "false"
            });

            if (permission === null)
                await response.message("permission:error.already-exists");
            else
                await response.message("permission:created", {permission: perm_str, role: Role[role]});
        } catch (e) {
            logger.error("Unable to create new permission");
            logger.error("Caused by: " + e.message);
            logger.error(e.stack);
            return response.genericError();
        }
    }

    @Subcommand("delete", "del")
    async delete({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "permission delete [permission]",
            subcommand: "delete",
            arguments: tuple(
                entity({
                    name: "permission",
                    entity: PermissionEntity,
                    required: true,
                    error: {msgKey: "permission:error.unknown", optionKey: "permission"}
                })
            ),
            permission: this.permissionModule.deletePerm
        }));
        if (status !== ValidatorStatus.OK) return;
        const [permission] = args;

        if (permission.moduleDefined)
            return response.message("permission:error.module-defined", {permission: permission.permission});

        permission.delete()
            .then(() => response.message("permission:deleted", {permission: permission.permission}))
            .catch(e => {
                response.genericError();
                logger.error("Unable to delete custom permission");
                logger.error("Caused by: " + e.message);
            logger.error(e.stack);
            });
    }

    @Subcommand("set")
    async set({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "permission set <permission> <level>",
            subcommand: "set",
            arguments: tuple(
                entity({
                    name: "permission",
                    entity: PermissionEntity,
                    required: true,
                    error: {msgKey: "permission:error.unknown", optionKey: "permission"}
                }),
                roleConverter("level")
            ),
            permission: this.permissionModule.setPerm
        }));
        if (status !== ValidatorStatus.OK) return;
        const [permission, role] = args;

        if (!await msg.checkPermission(permission.permission)) {
            await response.message("permission:error.not-permitted");
            return;
        }

        permission.role = role;
        permission.save()
            .then(() => response.message("permission:set", {permission: permission.permission, role: Role[role]}))
            .catch(e => {
                response.genericError();
                logger.error("Unable to set permission level");
                logger.error("Caused by: " + e.message);
            logger.error(e.stack);
            });
    }

    @Subcommand("reset")
    async reset({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "permission reset [permission]",
            subcommand: "reset",
            arguments: tuple(
                entity({
                    name: "permission",
                    entity: PermissionEntity,
                    required: true,
                    error: {msgKey: "permission:error.unknown", optionKey: "permission"}
                })
            ),
            permission: this.permissionModule.resetPerm
        }));
        if (status !== ValidatorStatus.OK) return;
        const [permission] = args;

        if (permission) {
            if (!(await msg.checkPermission(permission.permission)))
                await response.message("permission:error.not-permitted");

            permission.role = permission.defaultRole;
            await permission.save()
                .then(() => response.message("permissions:reset", {permission: permission.permission}))
                .catch(e => {
                    response.genericError();
                    logger.error("Unable to reset permission");
                    logger.error("Caused by: " + e.message);
            logger.error(e.stack);
                });
        } else {
            if (!(await msg.checkPermission(this.permissionModule.resetAllPerms)))
                await response.message("permission:error.not-permitted");

            PermissionSystem.getInstance().resetChannelPermissions(msg.getChannel())
                .then(() => response.message("permission:reset-all"))
                .catch(e => {
                    response.genericError();
                    logger.error("Unable to reset all permissions");
                    logger.error("Caused by: " + e.message);
            logger.error(e.stack);
                });
        }
    }
}

@HandlesEvents()
export default class PermissionModule extends AbstractModule {
    static [Symbols.ModuleInfo] = MODULE_INFO;

    constructor() {
        super(PermissionModule);

        this.coreModule = true;
    }

    @command permissionCommand = new PermissionCommand(this);

    @permission createPerm = new Permission("permission.create", Role.MODERATOR);
    @permission deletePerm = new Permission("permission.delete", Role.MODERATOR);
    @permission setPerm = new Permission("permission.set", Role.MODERATOR);
    @permission grantPerm = new Permission("permission.grant", Role.MODERATOR);
    @permission denyPerm = new Permission("permission.deny", Role.MODERATOR);
    @permission resetPerm = new Permission("permission.reset", Role.MODERATOR);
    @permission resetAllPerms = new Permission("permission.reset.all", Role.BROADCASTER);

    @ExpressionContextResolver
    expressionContextResolver(msg: Message): ExpressionContext {
        return {
            sender: {
                isA: async (input: string): Promise<boolean> => {
                    const role = parseRole(input);
                    if (role === null) {
                        logger.warn("User input an invalid role: " + input);
                        return false;
                    }
                    return await getMaxRole(await msg.getUserRoles()) >= role;
                },
                can: async (permStr: string): Promise<boolean> => {
                    if (!permStr) return false;
                    try {
                        return await msg.checkPermission(permStr);
                    } catch (e) {
                        logger.error("Unable to check permission");
                        logger.error("Caused by: " + e.message);
                        logger.error(e.stack);
                        return false;
                    }
                }
            }
        }
    }

    @EventHandler(NewChannelEvent)
    async onNewChannel({channel}: NewChannelEventArgs): Promise<void> {
        await PermissionEntity.createTable({channel});
        await PermissionSystem.getInstance().resetChannelPermissions(channel);
    }
}