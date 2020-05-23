import AbstractModule, {ModuleInfo, Systems} from "./AbstractModule";
import PermissionEntity from "../Database/Entities/PermissionEntity";
import {getMaxRole, parseRole, Role} from "../Systems/Permissions/Role";
import PermissionSystem from "../Systems/Permissions/PermissionSystem";
import Permission from "../Systems/Permissions/Permission";
import {NewChannelEvent, NewChannelEventArgs} from "../Chat/Events/NewChannelEvent";
import {EventHandler, HandlesEvents} from "../Systems/Event/decorators";
import Command from "../Systems/Commands/Command";
import {CommandEventArgs} from "../Systems/Commands/CommandEvent";
import {onePartConverter} from "../Systems/Commands/Validator/Converter";
import {InvalidArgumentError} from "../Systems/Commands/Validator/ValidationErrors";
import {string} from "../Systems/Commands/Validator/String";
import {ValidatorStatus} from "../Systems/Commands/Validator/Strategies/ValidationStrategy";
import StandardValidationStrategy from "../Systems/Commands/Validator/Strategies/StandardValidationStrategy";
import {tuple} from "../Utilities/ArrayUtils";
import {entity} from "../Systems/Commands/Validator/Entity";
import getLogger from "../Utilities/Logger";

export const MODULE_INFO = {
    name: "Permission",
    version: "1.0.0",
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
    constructor() {
        super("permission", "<create|delete|set|reset>", ["perm"]);

        this.addSubcommand("create", this.create);
        this.addSubcommand("delete", this.delete);
        this.addSubcommand("del", this.delete);
        this.addSubcommand("set", this.set);
        this.addSubcommand("reset", this.reset);
    }

    async create({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "permission create <permission> <default-level>",
            arguments: tuple(
                string({name: "permission", required: true}),
                roleConverter("default role")
            ),
            permission: "permission.create"
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

    async delete({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "permission reset [permission]",
            arguments: tuple(
                entity({
                    name: "permission",
                    entity: PermissionEntity,
                    required: true,
                    error: {msgKey: "permission:error.unknown", optionKey: "permission"}
                })
            ),
            permission: "permission.delete"
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

    async set({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "permission set <permission> <level>",
            arguments: tuple(
                entity({
                    name: "permission",
                    entity: PermissionEntity,
                    required: true,
                    error: {msgKey: "permission:error.unknown", optionKey: "permission"}
                }),
                roleConverter("level")
            ),
            permission: "permission.set"
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

    async reset({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "permission reset [permission]",
            arguments: tuple(
                entity({
                    name: "permission",
                    entity: PermissionEntity,
                    required: true,
                    error: {msgKey: "permission:error.unknown", optionKey: "permission"}
                })
            ),
            permission: "permission.reset"
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
            if (!(await msg.checkPermission("permission.reset.all")))
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
    constructor() {
        super(PermissionModule.name);

        this.coreModule = true;
    }

    initialize({ command, permission, expression }: Systems): ModuleInfo {
        command.registerCommand(new PermissionCommand(), this);
        permission.registerPermission(new Permission("permission.set", Role.MODERATOR));
        permission.registerPermission(new Permission("permission.grant", Role.MODERATOR));
        permission.registerPermission(new Permission("permission.deny", Role.MODERATOR));
        permission.registerPermission(new Permission("permission.reset", Role.MODERATOR));
        permission.registerPermission(new Permission("permission.reset.all", Role.BROADCASTER));
        expression.registerResolver(msg => ({
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
        }));

        return MODULE_INFO;
    }

    @EventHandler(NewChannelEvent)
    async onNewChannel({channel}: NewChannelEventArgs): Promise<void> {
        await PermissionEntity.createTable({channel});
        await PermissionSystem.getInstance().resetChannelPermissions(channel);
    }
}