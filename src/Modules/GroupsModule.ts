import AbstractModule from "./AbstractModule";
import {ConfirmationFactory, ConfirmedEvent} from "./ConfirmationModule";
import Message from "../Chat/Message";
import GroupsEntity from "../Database/Entities/GroupsEntity";
import GroupMembersEntity from "../Database/Entities/GroupMembersEntity";
import GroupPermissionsEntity from "../Database/Entities/GroupPermissionsEntity";
import ChatterEntity from "../Database/Entities/ChatterEntity";
import PermissionSystem from "../Systems/Permissions/PermissionSystem";
import Permission from "../Systems/Permissions/Permission";
import {Role} from "../Systems/Permissions/Role";
import {Key} from "../Utilities/Translator";
import Logger from "../Utilities/Logger";
import {NewChannelEvent, NewChannelEventArgs} from "../Chat/Events/NewChannelEvent";
import {EventHandler, HandlesEvents} from "../Systems/Event/decorators";
import {inject} from "inversify";
import symbols from "../symbols";
import CommandSystem from "../Systems/Commands/CommandSystem";
import Command from "../Systems/Commands/Command";
import {CommandEventArgs} from "../Systems/Commands/CommandEvent";

@HandlesEvents()
export default class GroupsModule extends AbstractModule {
    constructor(@inject(symbols.ConfirmationFactory) private makeConfirmation: ConfirmationFactory) {
        super(GroupsModule.name);

        this.coreModule = true;
    }

    initialize(): void {
        const cmd = CommandSystem.getInstance();
        cmd.registerCommand(new GroupCommand(this.makeConfirmation), this);

        const perm = PermissionSystem.getInstance();
        perm.registerPermission(new Permission("permission.group.add", Role.MODERATOR));
        perm.registerPermission(new Permission("permission.group.remove", Role.MODERATOR));
        perm.registerPermission(new Permission("permission.group.create", Role.MODERATOR));
        perm.registerPermission(new Permission("permission.group.delete", Role.BROADCASTER));
    }

    public static groupArgConverter = async (raw: string, msg: Message): Promise<GroupsEntity|null> => GroupsEntity.findByName(raw, msg.getChannel());

    @EventHandler(NewChannelEvent)
    async onNewChannel({ channel }: NewChannelEventArgs): Promise<void> {
        await GroupsEntity.createTable({ channel });
        await GroupMembersEntity.createTable({ channel });
        await GroupPermissionsEntity.createTable({ channel });
    }
}

class GroupCommand extends Command {
    constructor(private confirmationFactory: ConfirmationFactory) {
        super("group", "<add|remove|create|delete|grant|deny|reset>", ["g"]);

        this.addSubcommand("add", this.addMember);
        this.addSubcommand("remove", this.removeMember);
        this.addSubcommand("create", this.createGroup);
        this.addSubcommand("delete", this.deleteGroup);
        this.addSubcommand("grant", this.grantPerm);
        this.addSubcommand("deny", this.denyPerm);
        this.addSubcommand("reset", this.resetPerms);
    }

    async addMember({event, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "group add <group> <user>",
            arguments: [
                {
                    value: {
                        type: "custom",
                        converter: GroupsModule.groupArgConverter
                    },
                    required: true
                },
                {
                    value: {
                        type: "chatter",
                    },
                    required: true
                }
            ],
            permission: "permission.group.add"
        });
        if (args === null) return;
        const [group, chatter] = args as [GroupsEntity, ChatterEntity];

        GroupMembersEntity.create(chatter.userId, group)
            .then(added => {
                if (added) response.message(Key("permissions.group.user.added"), chatter.name, group.name);
                else response.message(Key("permissions.group.user.already_a_member"), chatter.name, group.name);
            })
            .catch((e) => {
                Logger.get().error("Unable to add user to group", {cause: e});
                response.message(Key("permissions.group.user.failed_to_add"), chatter.name, group.name);
            });
    }

    async removeMember({event, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "group remove <group> <user>",
            arguments: [
                {
                    value: {
                        type: "custom",
                        converter: GroupsModule.groupArgConverter
                    },
                    required: true
                },
                {
                    value: {
                        type: "chatter",
                    },
                    required: true
                }
            ],
            permission: "permission.group.remove"
        });
        if (args === null) return;
        const [group, chatter] = args as [GroupsEntity, ChatterEntity];

        try {
            const member = await GroupMembersEntity.findByUser(chatter, group);
            if (member === null)
                return response.message(Key("permissions.group.user.not_a_member"), chatter.name, group);
            await member.delete();
            return response.message(Key("permissions.group.user.removed"), chatter.name, group);
        } catch (e) {
            Logger.get().error("Unable to remove user from the group", {cause: e});
            return response.message(Key("permissions.group.user.failed_to_remove"), chatter.name, group);
        }
    }

    async createGroup({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "group create <group>",
            arguments: [
                {
                    value: {
                        type: "string",
                    },
                    required: true
                }
            ],
            permission: "permission.group.create"
        });
        if (args === null) return;
        const [name] = args;

        try {
            const group = await GroupsEntity.create(name, msg.getChannel());
            if (group === null)
                return response.message(Key("permissions.group.create.already_exists"), name);
            return response.message(Key("permissions.group.create.successful"), name);
        } catch (e) {
            Logger.get().error("Unable to create the group", {cause: e});
            return response.message(Key("permissions.group.create.failed"), name);
        }
    }

    async deleteGroup({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "group delete <group>",
            arguments: [
                {
                    value: {
                        type: "custom",
                        converter: GroupsModule.groupArgConverter
                    },
                    required: true
                }
            ],
            permission: "permission.group.delete"
        });
        if (args === null) return;
        const [group] = args as [GroupsEntity];

        const confirmation = await this.confirmationFactory(msg, response.translate(Key("permissions.group.delete.confirmation"), group), 30);
        confirmation.addListener(ConfirmedEvent, async () => {
            try {
                await group.delete();
                return response.message(Key("permissions.group.delete.successful"), group);
            } catch (e) {
                Logger.get().error("Unable to delete the group", {cause: e});
                return response.message(Key("permissions.group.delete.failed"), group);
            }
        });
        confirmation.run();
    }

    async grantPerm({event, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "group grant <group> <permission>",
            arguments: [
                {
                    value: {
                        type: "custom",
                        converter: GroupsModule.groupArgConverter
                    },
                    required: true
                },
                {
                    value: {
                        type: "string",
                    },
                    required: true
                }
            ],
            permission: "permission.grant"
        });
        if (args === null) return;
        const [group, permStr] = args as [GroupsEntity, string];

        await GroupPermissionsEntity.update(group, permStr, true)
            .then(() => response.message(Key("groups.permission.granted.successful"), permStr, group.name))
            .catch(e => {
                response.message(Key("groups.permission.granted.failed"), permStr, group.name);
                Logger.get().error("Unable to grant permission to group", { cause: e });
            });
    }

    async denyPerm({event, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "group deny <group> <permission>",
            arguments: [
                {
                    value: {
                        type: "custom",
                        converter: GroupsModule.groupArgConverter
                    },
                    required: true
                },
                {
                    value: {
                        type: "string",
                    },
                    required: true
                }
            ],
            permission: "permission.deny"
        });
        if (args === null) return;
        const [group, permStr] = args as [GroupsEntity, string];

        await GroupPermissionsEntity.update(group, permStr, false)
            .then(() => response.message(Key("groups.permission.denied.successful"), group.name, permStr))
            .catch(e => {
                response.message(Key("groups.permission.denied.failed"), group.name, permStr);
                Logger.get().error("Unable to deny permission for group", { cause: e });
            });
    }

    async resetPerms({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "group reset <group> [permission]",
            arguments: [
                {
                    value: {
                        type: "custom",
                        converter: GroupsModule.groupArgConverter
                    },
                    required: true
                },
                {
                    value: {
                        type: "string",
                    },
                    required: false
                }
            ],
            permission: "permission.reset"
        });
        if (args === null) return;
        const [group, permStr] = args as [GroupsEntity, string|undefined];

        if (permStr) {
            await GroupPermissionsEntity.delete(group, permStr)
                .then(() => response.message(Key("groups.permission.deleted.specific.successful"), group.name, permStr))
                .catch(e => {
                    response.message(Key("groups.permission.deleted.specific.failed"), group.name, permStr);
                    Logger.get().error("Unable to deny permission for group", { cause: e });
                });
        } else {
            const confirmation = await this.confirmationFactory(msg, response.translate(Key("groups.permission.deleted.all.confirm")), 30);
            confirmation.addListener(ConfirmedEvent, () => {
                return GroupPermissionsEntity.clear(group)
                    .then(() => response.message(Key("groups.permission.deleted.all.failed.successful"), group.name, permStr))
                    .catch(e => {
                        response.message(Key("groups.permission.deleted.all.failed"), group.name, permStr);
                        Logger.get().error("Unable to deny permission for group", { cause: e });
                    });
            });
            confirmation.run();
        }
    }
}