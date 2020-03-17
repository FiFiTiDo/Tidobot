import AbstractModule from "./AbstractModule";
import ChannelSchemaBuilder from "../Database/ChannelSchemaBuilder";
import CommandModule, {CommandEvent, SubcommandHelper} from "./CommandModule";
import Application from "../Application/Application";
import PermissionModule, {PermissionLevel} from "./PermissionModule";
import Channel from "../Chat/Channel";
import {__} from "../Utilities/functions";
import Chatter from "../Chat/Chatter";
import ConfirmationModule, {ConfirmedEvent} from "./ConfirmationModule";
import Message from "../Chat/Message";
import {where} from "../Database/BooleanOperations";
import {RowData} from "../Database/QueryBuilder";
import GroupsEntity from "../Database/Entities/GroupsEntity";
import GroupMembersEntity from "../Database/Entities/GroupMembersEntity";
import Entity from "../Database/Entities/Entity";

export default class GroupsModule extends AbstractModule {
    constructor() {
        super(GroupsModule.name);

        this.coreModule = true;
    }

    initialize() {
        const cmd = this.getModuleManager().getModule(CommandModule);
        const perm = this.getModuleManager().getModule(PermissionModule);

        cmd.registerCommand("group", this.groupCommand, this);
        cmd.registerCommand("g", this.groupCommand, this);

        perm.registerPermission("permission.group.add", PermissionLevel.MODERATOR);
        perm.registerPermission("permission.group.remove", PermissionLevel.MODERATOR);
        perm.registerPermission("permission.group.create", PermissionLevel.MODERATOR);
        perm.registerPermission("permission.group.delete", PermissionLevel.BROADCASTER);
    }

    private groupNameArgConverter = async (raw: string, msg: Message) => {
        let id;
        try {
            id = this.getGroupId(msg.getChannel(), raw);
        } catch (e) {
            Application.getLogger().error("Unable to resolve group name to ID.", { cause: e });
            return null;
        }

        if (id < 0) {
            await msg.reply(__("permissions.group.unknown", raw));
            return null;
        }

        return id;
    };

    createDatabaseTables(builder: ChannelSchemaBuilder) {
        builder.addTable("groups", (table) => {
            table.string('name').unique();
        });
        builder.addTable("groupMembers", (table) => {
            table.integer('user_id').references(builder.getTableName("users"), "id");
            table.integer('group_id').references(builder.getTableName("group"), "id");
        });
    }

    groupCommand(event: CommandEvent) {
        new SubcommandHelper.Builder()
            .addSubcommand("add", this.addToGroup)
            .addSubcommand("remove", this.removeFromGroup)
            .addSubcommand("create", this.createGroup)
            .addSubcommand("delete", this.deleteGroup)
            .showUsageOnDefault("group <add|remove|create|delete>")
            .build(this)
            .handle(event);
    }

    async getGroupId(channel: Channel, name: string): Promise<GroupsEntity> {
        return GroupsEntity.findByName(name, this.getServiceName(), channel.getName());
    }

    async addToGroup(event: CommandEvent) {
        let msg = event.getMessage();
        let args = await event.validate({
            usage: "group add <group> <user>",
            arguments: [
                {
                    type: "custom",
                    required: true,
                    converter: this.groupNameArgConverter
                },
                {
                    type: "chatter",
                    required: true
                }
            ],
            permission: "permission.group.add"
        });
        if (args === null) return;
        let [group, chatter] = args as [GroupsEntity, Chatter];

        GroupMembersEntity.create(chatter.getId(), group)
            .then(added => {
                if (added) msg.reply(__("permissions.group.user.added", chatter.getName(), group.name));
                else msg.reply(__("permissions.group.user.already_a_member", chatter.getName(), group.name));
            })
            .catch((e) => {
                Application.getLogger().error("Unable to add user to group", {cause: e});
                msg.reply(__("permissions.group.user.failed_to_add", chatter.getName(), group.name));
            });
    };

    async removeFromGroup(event: CommandEvent) {
        let msg = event.getMessage();
        let args = await event.validate({
            usage: "group remove <group> <user>",
            arguments: [
                {
                    type: "custom",
                    required: true,
                    converter: this.groupNameArgConverter
                },
                {
                    type: "chatter",
                    required: true
                }
            ],
            permission: "permission.group.remove"
        });
        if (args === null) return;
        let [group, chatter] = args as [GroupsEntity, Chatter];

        try {
            let member = await GroupMembersEntity.findByUser(chatter.getId(), group);
            if (member === null)
                return msg.reply(__("permissions.group.user.not_a_member", chatter.getName(), group));
            await member.delete();
            return msg.reply(__("permissions.group.user.removed", chatter.getName(), group));
        } catch (e) {
            Application.getLogger().error("Unable to remove user from the group", {cause: e});
            return msg.reply(__("permissions.group.user.failed_to_remove", chatter.getName(), group));
        }
    }

    async createGroup(event: CommandEvent) {
        let msg = event.getMessage();
        let args = await event.validate({
            usage: "group create <group>",
            arguments: [
                {
                    type: "string",
                    required: true
                }
            ],
            permission: "permission.group.create"
        });
        if (args === null) return;
        let [name] = args;

        try {
            let group = await GroupsEntity.create(name, this.getServiceName(), msg.getChannel().getName());
            if (group === null)
                return msg.reply(__("permissions.group.create.already_exists", name));
            return msg.reply(__("permissions.group.create.successful", name))
        } catch (e) {
            Application.getLogger().error("Unable to create the group", {cause: e});
            return msg.reply(__("permissions.group.create.failed", name));
        }
    }

    async deleteGroup(event: CommandEvent) {
        let msg = event.getMessage();
        let args = await event.validate({
            usage: "group delete <group>",
            arguments: [
                {
                    type: "string",
                    required: true
                }
            ],
            permission: "permission.group.delete"
        });
        if (args === null) return;
        let [group] = args as [GroupsEntity];

        let confirmation = await Application.getModuleManager().getModule(ConfirmationModule)
            .make(msg, __("permissions.group.delete.confirmation", group), 30);
        confirmation.addListener(ConfirmedEvent, async () => {
            try {
                await group.delete();
                return msg.reply(__("permissions.group.delete.successful", group));
            } catch (e) {
                Application.getLogger().error("Unable to delete the group", {cause: e});
                return msg.reply(__("permissions.group.delete.failed", group));
            }
        });
        confirmation.run();
    }
}

export class Group {
    constructor(private readonly id: number, private readonly name: string, private readonly channel: Channel) {
    }

    static fromRow(row: RowData, channel: Channel) {
        return new Group(row.id, row.name, channel);
    }

    getName() {
        return this.name;
    }

    async isMember(user_id: string) {
        return this.channel.query("groupMembers").exists().where().eq("group_id", this.id).eq("user_id", user_id).done().exec()
    }

    async getMembers() {
        return this.channel.query("groupMembers").select().where().eq("group_id", this.id).done().all();
    }

    async getPermissions() {
        return this.channel.query("groupPermissions").select().where().eq("group_id", this.id).done().all();
    }

    async hasPermission(permission: string) {
        let perm = await this.channel.query("groupPermissions")
            .select().where().eq("group_id", this.id).eq("permission", permission).done().first();
        if (permission === null) return null;
        return perm.allowed;
    }

    async reset() {
        let where_clause = where().eq("id", this.id);
        await this.channel.query("groupMembers").delete().where(where_clause).exec();
        await this.channel.query("groupPermissions").delete().where(where_clause).exec();
    }

    async del() {
        await this.reset();
        await this.channel.query("groups").delete().where().eq("id", this.id).done().exec();
    }

    async retrieve(name: string, channel: Channel) {
        let row = await channel.query("groups").select().where().eq("name", name).done().first();
        if (row === null) return null;
        return Group.fromRow(row, channel);
    }
}