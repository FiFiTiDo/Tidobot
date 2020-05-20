import AbstractModule from "./AbstractModule";
import Message from "../Chat/Message";
import {where} from "../Database/Where";
import PermissionEntity from "../Database/Entities/PermissionEntity";
import {getMaxRole, parseRole, Role} from "../Systems/Permissions/Role";
import PermissionSystem from "../Systems/Permissions/PermissionSystem";
import Permission from "../Systems/Permissions/Permission";
import Logger from "../Utilities/Logger";
import {NewChannelEvent, NewChannelEventArgs} from "../Chat/Events/NewChannelEvent";
import {EventHandler, HandlesEvents} from "../Systems/Event/decorators";
import ExpressionSystem from "../Systems/Expressions/ExpressionSystem";
import CommandSystem from "../Systems/Commands/CommandSystem";
import Command from "../Systems/Commands/Command";
import {CommandEventArgs} from "../Systems/Commands/CommandEvent";
import {onePartConverter} from "../Systems/Commands/Validator/Converter";
import {InvalidArgumentError, InvalidInputError} from "../Systems/Commands/Validator/ValidationErrors";
import {string} from "../Systems/Commands/Validator/String";
import {ValidatorStatus} from "../Systems/Commands/Validator/Strategies/ValidationStrategy";
import StandardValidationStrategy from "../Systems/Commands/Validator/Strategies/StandardValidationStrategy";

@HandlesEvents()
export default class PermissionModule extends AbstractModule {
    constructor() {
        super(PermissionModule.name);

        this.coreModule = true;
    }

    initialize(): void {
        const cmd = CommandSystem.getInstance();
        cmd.registerCommand(new PermissionCommand(), this);

        const perm = PermissionSystem.getInstance();
        perm.registerPermission(new Permission("permission.set", Role.MODERATOR));
        perm.registerPermission(new Permission("permission.grant", Role.MODERATOR));
        perm.registerPermission(new Permission("permission.deny", Role.MODERATOR));
        perm.registerPermission(new Permission("permission.reset", Role.MODERATOR));
        perm.registerPermission(new Permission("permission.reset.all", Role.BROADCASTER));

        ExpressionSystem.getInstance().registerResolver(msg => ({
            sender: {
                isA: async (input: string): Promise<boolean> => {
                    const role = parseRole(input);
                    if (role === null) {
                        Logger.get().warning("User input an invalid role: " + input);
                        return false;
                    }
                    return await getMaxRole(await msg.getUserRoles()) >= role;
                },
                can: async (permStr: string): Promise<boolean> => {
                    if (!permStr) return false;
                    try {
                        return await msg.checkPermission(permStr);
                    } catch (e) {
                        Logger.get().error("Unable to check permission", {cause: e});
                        return false;
                    }
                }
            }
        }));
    }

    @EventHandler(NewChannelEvent)
    async onNewChannel({channel}: NewChannelEventArgs): Promise<void> {
        await PermissionEntity.createTable({channel});
        await PermissionSystem.getInstance().resetChannelPermissions(channel);
    }
}

const permissionConverter = onePartConverter("permission", "permission", true, null, async (part, column, msg) => {
    const perm = PermissionEntity.retrieve({channel: msg.getChannel()}, where().eq("permission", part));
    if (perm === null)
        throw new InvalidInputError(await msg.getResponse().translate("permission:error.unknown", {permission: part}));
    return perm;
});

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
            arguments: [
                string({ name: "permission", required: true }),
                roleConverter("default role")
            ],
            permission: "permission.create"
        }));
         if (status !== ValidatorStatus.OK) return;
        const [perm_str, role] = args as [string, Role];

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
        } catch (err) {
            Logger.get().error("Unable to create new permission", {cause: err});
            return response.genericError();
        }
    }

    async delete({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "permission reset [permission]",
            arguments: [
                permissionConverter
            ],
            permission: "permission.delete"
        }));
         if (status !== ValidatorStatus.OK) return;
        const [permission] = args as [PermissionEntity];

        if (permission.moduleDefined)
            return response.message("permission:error.module-defined", {permission: permission.permission});

        permission.delete()
            .then(() => response.message("permission:deleted", {permission: permission.permission}))
            .catch(e => {
                response.genericError();
                Logger.get().error("Unable to delete custom permission", {cause: e});
            });
    }

    async set({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "permission set <permission> <level>",
            arguments: [
                permissionConverter,
                roleConverter("level")
            ],
            permission: "permission.set"
        }));
         if (status !== ValidatorStatus.OK) return;
        const [permission, role] = args as [PermissionEntity, Role];

        if (!await msg.checkPermission(permission.permission)) {
            await response.message("permission:error.not-permitted");
            return;
        }

        permission.role = role;
        permission.save()
            .then(() => response.message("permission:set", {permission: permission.permission, role: Role[role]}))
            .catch(e => {
                response.genericError();
                Logger.get().error("Unable to set permission level", {cause: e});
            });
    }

    async reset({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "permission reset [permission]",
            arguments: [
                permissionConverter
            ],
            permission: "permission.reset"
        }));
         if (status !== ValidatorStatus.OK) return;
        const [permission] = args as [PermissionEntity | undefined];

        if (permission) {
            if (!(await msg.checkPermission(permission.permission)))
                await response.message("permission:error.not-permitted");

            permission.role = permission.defaultRole;
            await permission.save()
                .then(() => response.message("permissions:reset", {permission: permission.permission}))
                .catch(e => {
                    response.genericError();
                    Logger.get().error("Unable to reset permission", {cause: e});
                });
        } else {
            if (!(await msg.checkPermission("permission.reset.all")))
                await response.message("permission:error.not-permitted");

            PermissionSystem.getInstance().resetChannelPermissions(msg.getChannel())
                .then(() => response.message("permission:reset-all"))
                .catch(e => {
                    response.genericError();
                    Logger.get().error("Unable to reset all permissions", {cause: e});
                });
        }
    }
}