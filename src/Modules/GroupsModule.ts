import AbstractModule, {ModuleInfo, Systems} from "./AbstractModule";
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
import {CommandEventArgs} from "../Systems/Commands/CommandEvent";
import {chatter as chatterConverter} from "../Systems/Commands/Validator/Chatter";
import {string} from "../Systems/Commands/Validator/String";
import StandardValidationStrategy from "../Systems/Commands/Validator/Strategies/StandardValidationStrategy";
import {ValidatorStatus} from "../Systems/Commands/Validator/Strategies/ValidationStrategy";
import {tuple} from "../Utilities/ArrayUtils";
import {entity} from "../Systems/Commands/Validator/Entity";
import {getLogger} from "log4js";

export const MODULE_INFO = {
    name: "Group",
    version: "1.0.0",
    description: "Assign users groups to allow for granting permissions to groups of people rather than individually"
};

const logger = getLogger(MODULE_INFO.name);

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
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "group add <group> <user>",
            arguments: tuple(
                entity({
                    name: "group",
                    entity: GroupsEntity,
                    required: true,
                    error: {msgKey: "groups:error.unknown", optionKey: "group"}
                }),
                chatterConverter({ name: "user", required: true })
            ),
            permission: "permission.group.add"
        }));
        if (status !== ValidatorStatus.OK) return;
        const [group, chatter] = args;

        GroupMembersEntity.create(chatter.userId, group)
            .then(added => response.message(added ? "groups:user.added" : "groups:user.already", {
                username: chatter.name,
                group: group.name
            })).catch((e) => {
            logger.error("Unable to add user to group");
            logger.trace("Caused by: " + e.message);
            return response.genericError();
        });
    }

    async removeMember({event, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "group remove <group> <user>",
            arguments: tuple(
                entity({
                    name: "group",
                    entity: GroupsEntity,
                    required: true,
                    error: {msgKey: "groups:error.unknown", optionKey: "group"}
                }),
                chatterConverter({ name: "user", required: true })
            ),
            permission: "permission.group.remove"
        }));
        if (status !== ValidatorStatus.OK) return;
        const [group, chatter] = args;

        try {
            const member = await GroupMembersEntity.findByUser(chatter, group);
            if (member === null)
                return response.message("groups:user.not", {username: chatter.name, group: group.name});
            await member.delete();
            return response.message("groups:user.removed", {username: chatter.name, group: group.name});
        } catch (e) {
            logger.error("Unable to remove user from the group");
            logger.trace("Caused by: " + e.message);
            return response.genericError();
        }
    }

    async createGroup({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "group create <group>",
            arguments: tuple(
                string({ name: "group name", required: true })
            ),
            permission: "permission.group.create"
        }));
        if (status !== ValidatorStatus.OK) return;
        const [name] = args;

        try {
            const group = await GroupsEntity.create(name, msg.getChannel());
            return response.message(group === null ? "groups:error.exists" : "groups:created", {group: name});
        } catch (e) {
            logger.error("Unable to create the group");
            logger.trace("Caused by: " + e.message);
            return response.genericError();
        }
    }

    async deleteGroup({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "group delete <group>",
            arguments: tuple(
                entity({
                    name: "group",
                    entity: GroupsEntity,
                    required: true,
                    error: {msgKey: "groups:error.unknown", optionKey: "group"}
                })
            ),
            permission: "permission.group.delete"
        }));
        if (status !== ValidatorStatus.OK) return;
        const [group] = args;

        const confirmation = await this.confirmationFactory(msg, await response.translate("groups:delete-confirm", {
            group: group.name
        }), 30);
        confirmation.addListener(ConfirmedEvent, async () => {
            try {
                await group.delete();
                return response.message("groups:deleted", {group: group.name});
            } catch (e) {
                logger.error("Unable to delete the group");
                logger.trace("Caused by: " + e.message);
                return response.genericError();
            }
        });
        confirmation.run();
    }

    async grantPerm({event, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "group grant <group> <permission>",
            arguments: tuple(
                entity({
                    name: "group",
                    entity: GroupsEntity,
                    required: true,
                    error: {msgKey: "groups:error.unknown", optionKey: "group"}
                }),
                string({ name: "permission", required: true })
            ),
            permission: "permission.grant"
        }));
        if (status !== ValidatorStatus.OK) return;
        const [group, permission] = args;

        await GroupPermissionsEntity.update(group, permission, true)
            .then(() => response.message("groups.permission.granted", {permission, group: group.name}))
            .catch(e => {
                logger.error("Unable to grant permission to group");
                logger.trace("Caused by: " + e.message);
                return response.genericError();
            });
    }

    async denyPerm({event, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "group deny <group> <permission>",
            arguments: tuple(
                entity({
                    name: "group",
                    entity: GroupsEntity,
                    required: true,
                    error: {msgKey: "groups:error.unknown", optionKey: "group"}
                }),
                string({ name: "permission", required: true })
            ),
            permission: "permission.deny"
        }));
        if (status !== ValidatorStatus.OK) return;
        const [group, permission] = args;

        await GroupPermissionsEntity.update(group, permission, false)
            .then(() => response.message("groups.permission.denied", {group: group.name, permission}))
            .catch(e => {
                logger.error("Unable to deny permission for group");
                logger.trace("Caused by: " + e.message);
                return response.genericError();
            });
    }

    async resetPerms({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "group reset <group> [permission]",
            arguments: tuple(
                entity({
                    name: "group",
                    entity: GroupsEntity,
                    required: true,
                    error: {msgKey: "groups:error.unknown", optionKey: "group"}
                }),
                string({ name: "permission", required: false, defaultValue: undefined })
            ),
            permission: "permission.reset"
        }));
        if (status !== ValidatorStatus.OK) return;
        const [group, permission] = args;

        if (permission) {
            await GroupPermissionsEntity.delete(group, permission)
                .then(() => response.message("groups:permission.delete.specific", {group: group.name, permission}))
                .catch(e => {
                    logger.error("Unable to deny permission for group");
                    logger.trace("Caused by: " + e.message);
                    return response.genericError();
                });
        } else {
            const confirmation = await this.confirmationFactory(msg, await response.translate("groups:permission.delete.confirm"), 30);
            confirmation.addListener(ConfirmedEvent, () => {
                return GroupPermissionsEntity.clear(group)
                    .then(() => response.message("groups:permission.delete.all", {group: group.name}))
                    .catch(e => {
                        logger.error("Unable to deny permission for group");
                        logger.trace("Caused by: " + e.message);
                        return response.genericError();
                    });
            });
            confirmation.run();
        }
    }
}

@HandlesEvents()
export default class GroupsModule extends AbstractModule {
    constructor(@inject(symbols.ConfirmationFactory) private makeConfirmation: ConfirmationFactory) {
        super(GroupsModule.name);

        this.coreModule = true;
    }

    initialize({ command, permission }: Systems): ModuleInfo {
        command.registerCommand(new GroupCommand(this.makeConfirmation), this);
        permission.registerPermission(new Permission("permission.group.add", Role.MODERATOR));
        permission.registerPermission(new Permission("permission.group.remove", Role.MODERATOR));
        permission.registerPermission(new Permission("permission.group.create", Role.MODERATOR));
        permission.registerPermission(new Permission("permission.group.delete", Role.BROADCASTER));

        return MODULE_INFO;
    }

    @EventHandler(NewChannelEvent)
    async onNewChannel({channel}: NewChannelEventArgs): Promise<void> {
        await GroupsEntity.createTable({channel});
        await GroupMembersEntity.createTable({channel});
        await GroupPermissionsEntity.createTable({channel});
    }
}

