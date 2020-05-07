import AbstractModule from "./AbstractModule";
import CommandModule, {Command, CommandEventArgs} from "./CommandModule";
import Message from "../Chat/Message";
import {where} from "../Database/Where";
import PermissionEntity from "../Database/Entities/PermissionEntity";
import {Key} from "../Utilities/Translator";
import {getMaxRole, parseRole, Role} from "../Systems/Permissions/Role";
import PermissionSystem from "../Systems/Permissions/PermissionSystem";
import Permission from "../Systems/Permissions/Permission";
import Logger from "../Utilities/Logger";
import {NewChannelEvent} from "../Chat/NewChannelEvent";
import {EventHandler} from "../Systems/Event/decorators";
import ExpressionSystem from "../Systems/Expressions/ExpressionSystem";

export default class PermissionModule extends AbstractModule {
    constructor() {
        super(PermissionModule.name);

        this.coreModule = true;
    }

    initialize(): void {
        const cmd = this.moduleManager.getModule(CommandModule);
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
    async onNewChannel({ channel }: NewChannelEvent.Arguments): Promise<void> {
        await PermissionEntity.createTable({ channel });
    }

}

class PermissionCommand extends Command {
    public static permissionArgConverter = async (raw: string, msg: Message): Promise<PermissionEntity|null> =>
        PermissionEntity.retrieve({channel: msg.getChannel()}, where().eq("permission", raw));

    constructor() {
        super("permission", "<set|reset>", ["perm"]);

        this.addSubcommand("set", this.set);
        this.addSubcommand("reset", this.reset);
    }

    async set({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "permission set <permission> <level>",
            arguments: [
                {
                    value: {
                        type: "custom",
                        converter: PermissionCommand.permissionArgConverter
                    },
                    required: true
                },
                {
                    value: {
                        type: "custom",
                        converter: parseRole
                    },
                    required: true
                }
            ],
            permission: "permission.set"
        });
        if (args === null) return;
        const [permission, level] = args as [PermissionEntity, Role];

        if (!await msg.checkPermission(permission.permission)) {
            await response.message(Key("permissions.permission.set.now_allowed"));
            return;
        }

        permission.role = Role[level];
        permission.save()
            .then(() => response.message(Key("permissions.permission.set.successful"), permission, Role[level]))
            .catch(e => {
                response.message(Key("permissions.permission.set.failed"), permission);
                Logger.get().error("Unable to set permission level", {cause: e});
            });
    }

    async reset({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "permission reset [permission]",
            arguments: [
                {
                    value: {
                        type: "custom",
                        converter: PermissionCommand.permissionArgConverter
                    },
                    required: false
                }
            ],
            permission: "permission.reset"
        });
        if (args === null) return;
        const [permission] = args as [PermissionEntity|undefined];

        if (permission) {
            if (!(await msg.checkPermission(permission.permission))) return response.message(Key("permissions.permission.reset.not_allowed"));

            const perm = PermissionSystem.getInstance().findPermission(permission.permission);
            if (perm !== null) {
                permission.role = Role[perm.getDefaultRole()];
                await permission.save()
                    .then(() => response.message(Key("permissions.permission.reset.successful"), permission.permission))
                    .catch(e => {
                        response.message(Key("permissions.permission.reset.failed"), permission.permission);
                        Logger.get().error("Unable to reset permission", {cause: e});
                    });
            } else {
                await permission.delete()
                    .then(() => response.message(Key("permissions.permission.delete.successful"), permission.permission))
                    .catch(e => {
                        response.message(Key("permissions.permission.delete.failed"), permission.permission);
                        Logger.get().error("Unable to delete permission", {cause: e});
                    });
            }
        } else {
            if (!(await msg.checkPermission("permission.reset.all"))) return;

            PermissionSystem.getInstance().resetChannelPermissions(msg.getChannel())
                .then(() => response.message(Key("permissions.permission.reset-all.successful")))
                .catch(e => {
                    response.message(Key("permissions.permission.reset-all.failed"));
                    Logger.get().error("Unable to reset all permissions", {cause: e});
                });
        }
    }
}