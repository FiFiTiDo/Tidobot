import AbstractModule, {Symbols} from "./AbstractModule";
import {ConfirmationFactory, ConfirmedEvent} from "./ConfirmationModule";
import GroupsEntity from "../Database/Entities/GroupsEntity";
import GroupMembersEntity from "../Database/Entities/GroupMembersEntity";
import GroupPermissionsEntity from "../Database/Entities/GroupPermissionsEntity";
import Permission from "../Systems/Permissions/Permission";
import {Role} from "../Systems/Permissions/Role";
import {NewChannelEvent, NewChannelEventArgs} from "../Chat/Events/NewChannelEvent";
import {EventHandler, HandlesEvents} from "../Systems/Event/decorators";
import {inject} from "inversify";
import symbols from "../symbols";
import Command from "../Systems/Commands/Command";
import {CommandEvent} from "../Systems/Commands/CommandEvent";
import {ChatterArg} from "../Systems/Commands/Validation/Chatter";
import {StringArg} from "../Systems/Commands/Validation/String";
import {EntityArg} from "../Systems/Commands/Validation/Entity";
import {getLogger} from "../Utilities/Logger";
import {command} from "../Systems/Commands/decorators";
import {permission} from "../Systems/Permissions/decorators";
import {CommandHandler} from "../Systems/Commands/Validation/CommandHandler";
import CheckPermission from "../Systems/Commands/Validation/CheckPermission";
import {Argument, Channel, MessageArg, ResponseArg} from "../Systems/Commands/Validation/Argument";
import {Response} from "../Chat/Response";
import ChatterEntity from "../Database/Entities/ChatterEntity";
import ChannelEntity from "../Database/Entities/ChannelEntity";
import Message from "../Chat/Message";

export const MODULE_INFO = {
    name: "Group",
    version: "1.1.1",
    description: "Assign users groups to allow for granting permissions to groups of people rather than individually"
};

const logger = getLogger(MODULE_INFO.name);
const GroupArg = new EntityArg(GroupsEntity, {msgKey: "groups:error.unknown", optionKey: "group"});

class GroupCommand extends Command {
    private readonly confirmationFactory: ConfirmationFactory;

    constructor(private readonly groupsModule: GroupsModule) {
        super("group", "<add|remove|create|delete|grant|deny|reset>", ["g"]);

        this.confirmationFactory = groupsModule.makeConfirmation;
    }

    @CommandHandler(/^g(roup)? add/, "group add <group> <user>", 1)
    @CheckPermission("group.add")
    async addMember(
        event: CommandEvent, @ResponseArg response: Response,
        @Argument(GroupArg) group: GroupsEntity, @Argument(new ChatterArg()) chatter: ChatterEntity
    ): Promise<void> {
        return GroupMembersEntity.create(chatter.userId, group)
            .then(added => response.message(added ? "groups:user.added" : "groups:user.already", {
                username: chatter.name,
                group: group.name
            }))
            .catch((e) => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^g(roup)? rem(ove)?/, "group remove <group> <user>", 1)
    @CheckPermission("group.remove")
    async removeMember(
        event: CommandEvent, @ResponseArg response: Response,
        @Argument(GroupArg) group: GroupsEntity, @Argument(new ChatterArg()) chatter: ChatterEntity
    ): Promise<void> {
        try {
            const member = await GroupMembersEntity.findByUser(chatter, group);
            if (member === null)
                return await response.message("groups:user.not", {username: chatter.name, group: group.name});
            await member?.delete();
            return await response.message("groups:user.removed", {username: chatter.name, group: group.name});
        } catch (e) {
            return await response.genericErrorAndLog(e, logger);
        }
    }

    @CommandHandler(/^g(roup)? create/, "group create <name>", 1)
    @CheckPermission("group.create")
    async createGroup(
        event: CommandEvent, @ResponseArg response: Response, @Channel channel: ChannelEntity,
        @Argument(StringArg) name: string
    ): Promise<void> {
        return GroupsEntity.create(name, channel)
            .then(group => response.message(group === null ? "groups:error.exists" : "groups:created", {group: name}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^g(roup)? del(ete)?/, "group delete <group>", 1)
    @CheckPermission("group.delete")
    async deleteGroup(
        event: CommandEvent, @ResponseArg response: Response, @MessageArg msg: Message,
        @Argument(GroupArg) group: GroupsEntity
    ): Promise<void> {
        const confirmMsg = await response.translate("groups:delete-confirm", {group: group.name});
        const confirmation = await this.confirmationFactory(msg, confirmMsg, 30);
        confirmation.addListener(ConfirmedEvent, async () => group.delete()
            .then(() => response.message("groups:deleted", {group: group.name}))
            .catch(e => response.genericErrorAndLog(e, logger))
        );
        confirmation.run();
    }

    @CommandHandler(/^g(roup)? grant/, "group grant <group> <permission>", 1)
    @CheckPermission("permission.grant")
    async grantPerm(
        event: CommandEvent, @ResponseArg response: Response,
        @Argument(GroupArg) group: GroupsEntity, @Argument(StringArg) permission: string
    ): Promise<void> {
        return GroupPermissionsEntity.update(group, permission, true)
            .then(() => response.message("groups:permission.granted", {permission, group: group.name}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^g(roup)? deny/, "group deny <group> <permission>", 1)
    @CheckPermission("permission.deny")
    async denyPerm(
        event: CommandEvent, @ResponseArg response: Response,
        @Argument(GroupArg) group: GroupsEntity, @Argument(StringArg) permission: string
    ): Promise<void> {
        return GroupPermissionsEntity.update(group, permission, false)
            .then(() => response.message("groups:permission.denied", {group: group.name, permission}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^g(roup)? reset/, "group reset <group> [permission]", 1)
    @CheckPermission("permission.reset")
    async resetPerms(
        event: CommandEvent, @ResponseArg response: Response, @MessageArg msg: Message,
        @Argument(GroupArg) group: GroupsEntity, @Argument(StringArg, "permission", false) permission: string
    ): Promise<void> {
        if (permission) { // Reset specific permission
            return GroupPermissionsEntity.delete(group, permission)
                .then(() => response.message("groups:permission.delete.specific", {group: group.name, permission}))
                .catch(e => response.genericErrorAndLog(e, logger));
        } else { // Reset all permissions for the group
            const confirmMsg = await response.translate("groups:permission.delete.confirm");
            const confirm = await this.confirmationFactory(msg, confirmMsg, 30);
            confirm.addListener(ConfirmedEvent, () => GroupPermissionsEntity.clear(group)
                .then(() => response.message("groups:permission.delete.all", {group: group.name}))
                .catch(e => response.genericErrorAndLog(e, logger))
            );
            confirm.run();
        }
    }
}

@HandlesEvents()
export default class GroupsModule extends AbstractModule {
    static [Symbols.ModuleInfo] = MODULE_INFO;
    @command groupCommand = new GroupCommand(this);
    @permission addToGroup = new Permission("group.add", Role.MODERATOR);
    @permission removeFromGroup = new Permission("group.remove", Role.MODERATOR);
    @permission createGroup = new Permission("group.create", Role.MODERATOR);
    @permission deleteGroup = new Permission("group.delete", Role.BROADCASTER);

    constructor(@inject(symbols.ConfirmationFactory) public makeConfirmation: ConfirmationFactory) {
        super(GroupsModule);

        this.coreModule = true;
    }

    @EventHandler(NewChannelEvent)
    async onNewChannel({channel}: NewChannelEventArgs): Promise<void> {
        await GroupsEntity.createTable({channel});
        await GroupMembersEntity.createTable({channel});
        await GroupPermissionsEntity.createTable({channel});
    }
}

