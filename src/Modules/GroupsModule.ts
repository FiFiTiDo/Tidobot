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
import {Where} from "../Database/BooleanOperations";
import {RowData} from "../Database/QueryBuilder";

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

    private async groupNameArgConverter(raw: string, msg: Message) {
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
    }

    createDatabaseTables(builder: ChannelSchemaBuilder) {
        builder.addTable("groups", (table) => {
            table.increments('id');
            table.string('name').unique();
        });
        builder.addTable("groupMembers", (table) => {
            table.increments('id');
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

    async getGroupId(channel: Channel, name: string): Promise<number> {
        return channel.query("groups").select().where().eq("name", name).done().first()
            .then(row => row === null ? -1 : row.id)
            .catch(e => {
                Application.getLogger().error("Unable to retrieve group id", {cause: e});
            });
    }

    async addToGroup(event: CommandEvent) {
        let msg = event.getMessage();
        let args = await event.validate({
            usage: "group add <group> <user>",
            arguments: [
                {
                    type: "string",
                    required: true
                },
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

        let group_id = args[1] as number;
        let chatter = args[2] as Chatter;
        let group = event.getArgument(1);
        let user_id = chatter.getId();
        let where = new Where(null).eq("group_id", group_id).eq("user_id", user_id);

        msg.getChannel().query("groupMembers")
            .exists().where(where).exec()
            .then(exists => {
                if (exists) {
                    msg.reply(__("permissions.group.user.already_a_member", chatter.getName(), group));
                } else {
                    msg.getChannel().query("groupMembers").insert({group_id, user_id}).exec()
                        .then(() => msg.reply(__("permissions.group.user.added", chatter.getName(), group)))
                        .catch((e) => {
                            Application.getLogger().error(e.message || e);
                            console.log((e as Error).stack);
                            msg.reply(__("permissions.group.user.failed_to_add", chatter.getName(), group));
                        });
                }
            })
            .catch((e) => {
                Application.getLogger().error("Unable to add user to group", {cause: e});
                msg.reply(__("permissions.group.user.failed_to_add", chatter.getName(), group));
            });
    };

    async removeFromGroup(event: CommandEvent) {
        let msg = event.getMessage();
        let args = await event.validate({
            usage: "group remove <group> <user>",
            arguments: [
                {
                    type: "string",
                    required: true
                },
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

        let group_id = args[1] as number;
        let chatter = args[2] as Chatter;
        let group = event.getArgument(1);
        let user_id = chatter.getId();
        let where = new Where(null).eq("group_id", group_id).eq("user_id", user_id);

        msg.getChannel().query("groupMembers").exists().where(where).exec()
            .then(exists => {
                if (!exists) {
                    msg.reply(__("permissions.group.user.not_a_member", chatter.getName(), group));
                } else {
                    msg.getChannel().query("groupMembers").delete().where(where).exec()
                        .then(() => msg.reply(__("permissions.group.user.removed", chatter.getName(), group)))
                        .catch((e) => {
                            Application.getLogger().error("Unable to remove user from the group", {cause: e});
                            msg.reply(__("permissions.group.user.failed_to_remove", chatter.getName(), group));
                        });
                }
            })
            .catch((e) => {
                Application.getLogger().error("Unable to remove user from the group", {cause: e});
                msg.reply(__("permissions.group.user.failed_to_remove", chatter.getName(), group));
            });
    };

    async createGroup(event: CommandEvent) {
        let msg = event.getMessage();
        let args = await event.validate({
            usage: "group create <group>",
            arguments: [
                {
                    type: "string",
                    required: true
                },
                {
                    type: "string",
                    required: true
                }
            ],
            permission: "permission.group.create"
        });
        if (args === null) return;
        let [, name] = args;

        msg.getChannel().query("groups")
            .exists().where().eq("name", name).done().exec()
            .then(exists => {
                if (exists) {
                    msg.reply(__("permissions.group.create.already_exists", name));
                } else {
                    msg.getChannel().query("groups").insert({name}).exec()
                        .then(() => msg.reply(__("permissions.group.create.successful", name)))
                        .catch((e) => {
                            Application.getLogger().error("Unable to create the group", {cause: e});
                            msg.reply(__("permissions.group.create.failed", name));
                        });
                }
            })
            .catch((e) => {
                Application.getLogger().error("Unable to create the group", {cause: e});
                msg.reply(__("permissions.group.create.failed", name));
            });
    };

    async deleteGroup(event: CommandEvent) {
        let msg = event.getMessage();
        let args = await event.validate({
            usage: "group create <group>",
            arguments: [
                {
                    type: "string",
                    required: true
                },
                {
                    type: "string",
                    required: true
                }
            ],
            permission: "permission.group.delete"
        });
        if (args === null) return;
        let [, group_id] = args;
        let group = event.getArgument(1);

        let confirmation = await Application.getModuleManager().getModule(ConfirmationModule)
            .make(msg, __("permissions.group.delete.confirmation", group), 30);
        confirmation.addListener(ConfirmedEvent, async () => {
            try {
                let where = new Where(null).eq("id", group_id);
                await msg.getChannel().query("groups").delete().where(where).exec();
                await msg.getChannel().query("groupMembers").delete().where(where).exec();
                await msg.getChannel().query("groupPermissions").delete().where(where).exec();
            } catch (e) {
                Application.getLogger().error("Unable to delete the group", {cause: e});
                return msg.reply(__("permissions.group.delete.failed", group));
            }
            await msg.reply(__("permissions.group.delete.successful", group));
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
        let where = new Where(null).eq("id", this.id);
        await this.channel.query("groupMembers").delete().where(where).exec();
        await this.channel.query("groupPermissions").delete().where(where).exec();
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