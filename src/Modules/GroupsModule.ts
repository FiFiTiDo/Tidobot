import AbstractModule, {Symbols} from "./AbstractModule";
import ConfirmationModule, {ConfirmedEvent} from "./ConfirmationModule";
import Permission from "../Systems/Permissions/Permission";
import {Role} from "../Systems/Permissions/Role";
import Command from "../Systems/Commands/Command";
import {CommandEvent} from "../Systems/Commands/CommandEvent";
import {ChatterArg} from "../Systems/Commands/Validation/Chatter";
import {StringArg} from "../Systems/Commands/Validation/String";
import {EntityArg} from "../Systems/Commands/Validation/Entity";
import {getLogger} from "../Utilities/Logger";
import {CommandHandler} from "../Systems/Commands/Validation/CommandHandler";
import CheckPermission from "../Systems/Commands/Validation/CheckPermission";
import {Argument, ChannelArg, MessageArg, ResponseArg} from "../Systems/Commands/Validation/Argument";
import {Response} from "../Chat/Response";
import Message from "../Chat/Message";
import { Service } from "typedi";
import PermissionModule, { PermissionArg } from "./PermissionModule";
import { Channel } from "../Database/Entities/Channel";
import { Chatter } from "../Database/Entities/Chatter";
import { Group } from "../Database/Entities/Group";
import { GroupRepository } from "../Database/Repositories/GroupRepository";
import { Permission as PermissionEntity } from "../Database/Entities/Permission";
import { InjectRepository } from "typeorm-typedi-extensions";

export const MODULE_INFO = {
    name: "Group",
    version: "1.2.0",
    description: "Assign users groups to allow for granting permissions to groups of people rather than individually"
};

const logger = getLogger(MODULE_INFO.name);
const GroupArg = new EntityArg(GroupRepository, {msgKey: "groups:error.unknown", optionKey: "group"});

class GroupCommand extends Command {
    constructor(
        private readonly confirmationModule: ConfirmationModule,
        @InjectRepository() private readonly groupRepository: GroupRepository
    ) {
        super("group", "<add|remove|create|delete|grant|deny|reset>", ["g"]);
    }

    @CommandHandler(/^g(roup)? add/, "group add <group> <user>", 1)
    @CheckPermission(() => GroupsModule.permissions.addToGroup)
    async addMember(
        event: CommandEvent, @ResponseArg response: Response,
        @Argument(GroupArg) group: Group, @Argument(new ChatterArg()) chatter: Chatter
    ): Promise<void> {
        return group.addMember(chatter)
            .then(added => response.message(added ? "groups:user.added" : "groups:user.already", {
                username: chatter.user.name,
                group: group.name
            }))
            .catch((e) => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^g(roup)? rem(ove)?/, "group remove <group> <user>", 1)
    @CheckPermission(() => GroupsModule.permissions.removeFromGroup)
    async removeMember(
        event: CommandEvent, @ResponseArg response: Response,
        @Argument(GroupArg) group: Group, @Argument(new ChatterArg()) chatter: Chatter
    ): Promise<void> {
        return group.removeMember(chatter)
            .then(removed => response.message(removed ? "groups:user.removed" : "groups:user.not", {
                username: chatter.user.name,
                group: group.name
            }))
            .catch((e) => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^g(roup)? create/, "group create <name>", 1)
    @CheckPermission(() => GroupsModule.permissions.createGroup)
    async createGroup(
        event: CommandEvent, @ResponseArg response: Response, @ChannelArg channel: Channel,
        @Argument(StringArg) name: string
    ): Promise<void> {
        if (await this.groupRepository.count({ name, channel }) > 0) response.message("groups:error.exists", {group: name});
        return this.groupRepository.create({ name, channel }).save()
            .then(() => response.message("groups:created", {group: name}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^g(roup)? del(ete)?/, "group delete <group>", 1)
    @CheckPermission(() => GroupsModule.permissions.deleteGroup)
    async deleteGroup(
        event: CommandEvent, @ResponseArg response: Response, @MessageArg msg: Message,
        @Argument(GroupArg) group: Group
    ): Promise<void> {
        const confirmMsg = await response.translate("groups:delete-confirm", {group: group.name});
        const confirmation = await this.confirmationModule.make(msg, confirmMsg, 30);
        confirmation.addListener(ConfirmedEvent, async () => group.remove()
            .then(() => response.message("groups:deleted", {group: group.name}))
            .catch(e => response.genericErrorAndLog(e, logger))
        );
        confirmation.run();
    }

    @CommandHandler(/^g(roup)? grant/, "group grant <group> <permission>", 1)
    @CheckPermission(() => PermissionModule.permissions.grantPerm)
    async grantPerm(
        event: CommandEvent, @ResponseArg response: Response,
        @Argument(GroupArg) group: Group, @Argument(PermissionArg) permission: PermissionEntity
    ): Promise<void> {
        return this.groupRepository.updatePermission(group, permission, true)
            .then(() => response.message("groups:permission.granted", {permission, group: group.name}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^g(roup)? deny/, "group deny <group> <permission>", 1)
    @CheckPermission(() => PermissionModule.permissions.denyPerm)
    async denyPerm(
        event: CommandEvent, @ResponseArg response: Response,
        @Argument(GroupArg) group: Group, @Argument(PermissionArg) permission: PermissionEntity
    ): Promise<void> {
        return this.groupRepository.updatePermission(group, permission, true)
            .then(() => response.message("groups:permission.denied", {group: group.name, permission}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^g(roup)? reset (.*)/, "group reset <group> <permission>", 1)
    @CheckPermission(() => PermissionModule.permissions.resetPerm)
    async resetPerm(
        event: CommandEvent, @ResponseArg response: Response, @Argument(GroupArg) group: Group,
        @Argument(PermissionArg) permission: PermissionEntity
    ): Promise<void> {
        return this.groupRepository.removePermission(group, permission)
            .then(() => response.message("groups:permission.delete.specific", {group: group.name, permission}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^g(roup)? reset$/, "group reset <group> [permission]", 1)
    @CheckPermission(() => PermissionModule.permissions.resetAllPerms)
    async resetAllPerms(
        event: CommandEvent, @ResponseArg response: Response, @MessageArg msg: Message, @Argument(GroupArg) group: Group
    ): Promise<void> {
        const confirmMsg = await response.translate("groups:permission.delete.confirm");
        const confirm = await this.confirmationModule.make(msg, confirmMsg, 30);
        confirm.addListener(ConfirmedEvent, () => this.groupRepository.removeAllPermissions(group)
            .then(() => response.message("groups:permission.delete.all", {group: group.name}))
            .catch(e => response.genericErrorAndLog(e, logger))
        );
        confirm.run();
    }
}

@Service()
export default class GroupsModule extends AbstractModule {
    static [Symbols.ModuleInfo] = MODULE_INFO;
    static permissions = {
        addToGroup: new Permission("group.add", Role.MODERATOR),
        removeFromGroup: new Permission("group.remove", Role.MODERATOR),
        createGroup: new Permission("group.create", Role.MODERATOR),
        deleteGroup: new Permission("group.delete", Role.BROADCASTER)
    }

    constructor(groupCommand: GroupCommand) {
        super(GroupsModule);

        this.coreModule = true;
        this.registerCommand(groupCommand);
    }
}

