import AbstractModule from "./AbstractModule";
import CommandModule, {CommandEvent, SubcommandHelper} from "./CommandModule";
import Chatter from "../Chat/Chatter";
import Channel from "../Chat/Channel";
import Application from "../Application/Application";
import ConfirmationModule, {ConfirmedEvent} from "./ConfirmationModule";
import Message from "../Chat/Message";
import {__} from "../Utilities/functions";
import ChannelSchemaBuilder from "../Database/ChannelSchemaBuilder";
import ExpressionModule from "./ExpressionModule";
import GroupsModule from "./GroupsModule";
import {Where} from "../Database/BooleanOperations";

export function get_max_level(levels: PermissionLevel[]) {
    if (levels.indexOf(PermissionLevel.BANNED) !== -1) return PermissionLevel.BANNED;

    let highest = levels[0];
    for (let level of levels)
        if (level > highest) highest = level;
    return highest;
}

export default class PermissionModule extends AbstractModule {
    private readonly permissions: { [key: string]: PermissionLevel };

    constructor() {
        super(PermissionModule.name);

        this.permissions = {};
        this.coreModule = true;
    }

    initialize() {
        const cmd = this.getModuleManager().getModule(CommandModule);

        cmd.registerCommand("permission", this.permissionCommand, this);
        cmd.registerCommand("perm", this.permissionCommand, this);
        cmd.registerCommand("p", this.permissionCommand, this);

        this.registerPermission("permission.set", PermissionLevel.MODERATOR);
        this.registerPermission("permission.grant", PermissionLevel.MODERATOR);
        this.registerPermission("permission.deny", PermissionLevel.MODERATOR);
        this.registerPermission("permission.reset", PermissionLevel.MODERATOR);
        this.registerPermission("permission.reset.all", PermissionLevel.BROADCASTER);

        this.getModuleManager().getModule(ExpressionModule).registerResolver(msg => {
            return {
                sender: {
                    isA: async (level_str: string) => {
                        let level = PermissionLevels.parse(level_str);
                        if (level === null) {
                            Application.getLogger().warning("User input an invalid level: " + level_str);
                            return false;
                        }
                        return await get_max_level(await msg.getUserLevels()) >= level;
                    },
                    can: async (permission_str: string) => {
                        if (!permission_str) return false;
                        try {
                            return await this.checkPermission(permission_str, msg.getChatter(), await msg.getUserLevels());
                        } catch (e) {
                            Application.getLogger().error("Unable to check permission", {cause: e});
                            return false;
                        }
                    }
                }
            }
        })
    }

    createDatabaseTables(builder: ChannelSchemaBuilder) {
        builder.addTable("permissions", (table) => {
            table.string('permission').primary();
            table.enum('level', ['BANNED', 'NORMAL', 'PREMIUM', 'REGULAR', 'SUBSCRIBER', 'VIP', 'MODERATOR', 'BROADCASTER', 'ADMIN', 'OWNER']);
        });
        builder.addTable("userPermissions", (table) => {
            table.string('permission');
            table.integer('user_id').references(builder.getTableName("users"), "id");
            table.boolean('allowed');
            table.unique("UserPermission", [ "permission", "user_id" ]);
        });
        builder.addTable("groupPermissions", (table) => {
            table.string('permission');
            table.integer('group_id').references(builder.getTableName("groups"), "id");
            table.boolean('allowed');
            table.unique("GroupPermission", [ "permission", "group_id" ]);
        });
    }

    registerPermission(perm_str: string, default_level: PermissionLevel) {
        this.permissions[perm_str] = default_level;
    }

    async checkPermission(permission: string, chatter: Chatter, user_levels: PermissionLevel[]) {
        try {
            if (await chatter.hasPermission(permission)) return true;
        } catch (e) {
            Application.getLogger().error("Unable to check permission", {cause: e});
            console.trace();
        }

        try {
            let level = await this.getPermissionLevel(permission, chatter.getChannel());
            return get_max_level(user_levels) >= level;
        } catch (e) {
            Application.getLogger().error("Unable to check permission", {cause: e});
            console.trace();
        }

        return false;
    }

    async getPermissionLevel(permission: string, channel: Channel): Promise<PermissionLevel> {
        try {
            let rows = await channel.query("permissions").select("level").where().eq("permission", permission).done().all();
            if (rows.length < 1) return PermissionLevel.OWNER;
            let level = rows[0].level as string;
            return PermissionLevel[level];
        } catch (e) {
            Application.getLogger().error("Unable to find permission in database", {cause: e});
            return PermissionLevel.OWNER;
        }
    }

    reset(channel: Channel) {
        return channel.query("permissions").delete().exec()
            .then(() => channel.query("permissions").insert(
                Object.entries(this.permissions).map(([permission, level]) => {
                    return {permission, level: PermissionLevel[level]};
                })
            ));
    }

    permissionCommand(event: CommandEvent) {
        new SubcommandHelper.Builder()
            .addSubcommand("set", this.setS)
            .addSubcommand("grant", this.grantS)
            .addSubcommand("deny", this.denyS)
            .addSubcommand("reset", this.resetS)
            .build(this)
            .handle(event);
    }

    async setS(event: CommandEvent) {
        let msg = event.getMessage();

        if (!(await msg.checkPermission("permission.set"))) return;
        if (event.getArgumentCount() < 3) {
            let prefix = await this.getModuleManager().getModule(CommandModule).getPrefix(msg.getChannel());
            await msg.reply(__("general.invalid_syntax", prefix + "permission set <permission> <level>"));
            return;
        }

        let permission = event.getArgument(1);
        let level_name = event.getArgument(2).toLowerCase();
        let level = PermissionLevels.parse(level_name);

        if (!await msg.checkPermission(permission)) {
            await msg.reply(__("permissions.permission.set.now_allowed"));
            return;
        }

        if (level === null) {
            await msg.reply(__("permissions.permission.invalid_level", level_name));
            return;
        }

        msg.getChannel().query("permissions")
            .insert({permission, level: PermissionLevel[level]}).or("REPLACE").exec()
            .then(() => msg.reply(__("permissions.permission.set.successful", permission, PermissionLevel[level])))
            .catch(e => {
                msg.reply(__("permissions.permission.set.failed", permission));
                Application.getLogger().error("Unable to set permission level", {cause: e});
            });
    };

    private async setAllowed(event: CommandEvent, allowed: boolean) {
        let msg = event.getMessage();
        let type = allowed ? "grant" : "deny";

        if (!(await msg.checkPermission("permission." + type))) return;
        if (event.getArgumentCount() < 2) {
            let prefix = await this.getModuleManager().getModule(CommandModule).getPrefix(msg.getChannel());
            await msg.reply(__("general.invalid_syntax", prefix + `permission ${type} <group:<group>|user:<user>> <permission>`));
            return;
        }

        let target_val = event.getArgument(1);
        let permission = event.getArgumentCount() > 2 ? event.getArgument(2) : null;

        if (permission !== null && !(await msg.checkPermission(permission))) {
            await msg.reply(__(`permissions.permission.${type}.not_allowed`));
            return;
        }

        let target = Target.getTarget(target_val, this, msg);

        if (target === null) {
            let prefix = await this.getModuleManager().getModule(CommandModule).getPrefix(msg.getChannel());
            await msg.reply(__("general.invalid_argument", "target", target_val, prefix + `permission ${type} <user:<username>|group:<groupname>> <permission>`));
            return;
        }

        await target.set(permission, allowed);
    }

    async grantS(event: CommandEvent) {
        await this.setAllowed(event, true);
    };

    async denyS(event: CommandEvent) {
        await this.setAllowed(event, false);
    };

    async resetS(event: CommandEvent) {
        let msg = event.getMessage();

        if (!(await msg.checkPermission("permission.reset"))) return;
        if (event.getArgumentCount() < 2) {
            let prefix = await this.getModuleManager().getModule(CommandModule).getPrefix(msg.getChannel());
            await msg.reply(__("general.invalid_syntax", prefix + "permission reset <group:<group>|user:<user>|perm:<permission>> [permission]"));
            return;
        }

        let target_val = event.getArgument(1);
        let permission = event.getArgumentCount() > 2 ? event.getArgument(2) : null;

        if (permission !== null && !(await msg.checkPermission(permission))) {
            await msg.reply(__("permissions.permission.reset.not_allowed"));
            return;
        }

        if (target_val.startsWith("perm:")) {
            let perm = target_val.substring(5);
            let where = new Where(null).eq("permission", perm);
            if (this.permissions.hasOwnProperty(perm)) {
                msg.getChannel().query("permissions")
                    .update({level: PermissionLevel[this.permissions[perm]]}).where(where).exec()
                    .then(() => msg.reply(__("permissions.permission.reset.successful", perm)))
                    .catch(e => {
                        msg.reply(__("permissions.permission.reset.failed", perm));
                        Application.getLogger().error("Unable to reset permission", {cause: e});
                    });
            } else {
                msg.getChannel().query("permissions").delete().where(where).exec()
                    .then(() => msg.reply(__("permissions.permission.delete.successful", perm)))
                    .catch(e => {
                        msg.reply(__("permissions.permission.delete.failed", perm));
                        Application.getLogger().error("Unable to delete permission", {cause: e});
                    });
            }
        } else {
            let target = Target.getTarget(target_val, this, msg);
            if (target === null)
                return this.getModuleManager().getModule(CommandModule)
                    .showInvalidArgument("target", target_val, "permission reset <group:<group>|user:<user>|perm:<permission>> [permission]", msg);

            return permission === null ? target.deleteAll() : target.delete(permission);
        }
    };
}

export enum PermissionLevel {
    BANNED, NORMAL, PREMIUM, REGULAR, SUBSCRIBER, VIP, MODERATOR, BROADCASTER, ADMIN, OWNER
}

export class PermissionLevels {
    static parse(text: string): PermissionLevel {
        switch (text.toLowerCase()) {
            case "banned":
                return PermissionLevel.BANNED;
            case "normal":
                return PermissionLevel.NORMAL;
            case "prime":
            case "turbo":
            case "premium":
                return PermissionLevel.PREMIUM;
            case "reg":
            case "regs":
            case "regular":
            case "regulars":
                return PermissionLevel.REGULAR;
            case "sub":
            case "subs":
            case "subscriber":
            case "subscribers":
                return PermissionLevel.SUBSCRIBER;
            case "vip":
                return PermissionLevel.VIP;
            case "mod":
            case "mods":
            case "moderator":
            case "moderators":
                return PermissionLevel.MODERATOR;
            case "streamer":
            case "broadcaster":
                return PermissionLevel.BROADCASTER;
            case "admin":
            case "admins":
                return PermissionLevel.ADMIN;
            case "owner":
            case "fifitido":
                return PermissionLevel.OWNER;
            default:
                return null;
        }
    }
}

abstract class Target {
    protected permission: PermissionModule;
    protected message: Message;
    protected target: string;

    constructor(target: string, permission: PermissionModule, msg: Message) {
        this.permission = permission;
        this.message = msg;
        this.target = target;
    }

    public static getTarget(target: string, permission: PermissionModule, msg: Message): Target {
        if (target.startsWith("user:")) {
            return new UserTarget(target.substring(5), permission, msg);
        } else if (target.startsWith("group:")) {
            return new GroupTarget(target.substring(6), permission, msg);
        }

        return null;
    }

    public abstract async set(perm_str: string, value: boolean): Promise<void>;

    public abstract async delete(perm_str: string): Promise<void>;

    public abstract async deleteAll(): Promise<void>;
}

class UserTarget extends Target {
    public async set(perm_str: string, allowed: boolean) {
        let user_id = await this.getUserId();

        if (user_id === null) return;

        return this.message.getChannel().query("userPermissions")
            .insert({permission: perm_str, user_id, allowed}).or("REPLACE").exec()
            .then(() => this.message.reply(__("permissions.user.permission." + (allowed ? "granted" : "denied") + ".successful", perm_str, this.target)))
            .catch((e) => {
                this.message.reply(__("permissions.user.permission." + (allowed ? "granted" : "denied") + ".failed", perm_str, this.target));
                Application.getLogger().error("Unable to set permission", {cause: e});
            });
    }

    public async delete(perm_str: string) {
        let user_id = await this.getUserId();

        if (user_id === null) return;

        return this.message.getChannel().query("userPermissions")
            .delete().where().eq("permission", perm_str).eq("user_id", user_id).done().exec()
            .then(() => this.message.reply(__("permissions.user.permission.delete", perm_str, this.target)))
            .catch((e) => {
                this.message.reply(__("permissions.group.permission.failed_to_delete", perm_str, this.target));
                Application.getLogger().error("Unable to delete permission", {cause: e});
            });
    }

    public async deleteAll() {
        let user_id = await this.getUserId();

        if (user_id === null) return;

        let confirmation = await Application.getModuleManager().getModule(ConfirmationModule)
            .make(this.message, "Are you sure you want to delete all of the user's permissions?", 30);
        confirmation.addListener(ConfirmedEvent, () => {
            this.message.getChannel().query("userPermissions")
                .delete().where().eq("user_id", user_id).done().exec()
                .then(() => this.message.reply(__("permissions.user.permission.delete_all", this.target)))
                .catch((e) => {
                    this.message.reply(__("permissions.user.permission.failed_to_delete_all", this.target));
                    Application.getLogger().error("Unable to delete all permissions", {cause: e});
                });
        });
        confirmation.run();
    }

    private async getUserId() {
        let user_name = this.target.substring(5);
        let chatter = await Chatter.find(user_name, this.message.getChannel());

        if (chatter === null) {
            await this.message.reply("User not found: " + user_name);
            return null;
        }

        return chatter.getId();
    }
}

class GroupTarget extends Target {
    public async set(perm_str: string, allowed: boolean) {
        let group_id = await this.getGroupId();

        if (group_id === null) return;

        return this.message.getChannel().query("groupPermissions")
            .insert({permission: perm_str, group_id, allowed}).or("REPLACE").exec()
            .then(() => this.message.reply(__("permissions.group.permission." + (allowed ? "granted" : "denied") + ".successful", perm_str, this.target)))
            .catch((e) => {
                this.message.reply(__("permissions.group.permission." + (allowed ? "granted" : "denied") + ".failed", perm_str, this.target));
                Application.getLogger().error("Unable to set permission", {cause: e});
            });
    }

    public async delete(perm_str: string) {
        let group_id = await this.getGroupId();

        if (group_id === null) return;

        return this.message.getChannel().query("groupPermissions")
            .delete().where().eq("permission", perm_str).eq("group_id", group_id).done().exec()
            .then(() => this.message.reply(__("permissions.group.permission.delete", perm_str, this.target)))
            .catch((e) => {
                this.message.reply(__("permissions.group.permission.failed_to_delete", perm_str, this.target));
                Application.getLogger().error("Unable to delete permission", {cause: e});
            });
    }

    public async deleteAll() {
        let group_id = await this.getGroupId();

        if (group_id === null) return;

        let confirmation = await Application.getModuleManager().getModule(ConfirmationModule)
            .make(this.message, "Are you sure you want to delete all the group's permissions?", 30);
        confirmation.addListener(ConfirmedEvent, () => {
            this.message.getChannel().query("groupPermissions")
                .delete().where().eq("group_id", group_id).done().exec()
                .then(() => this.message.reply(__("permissions.group.permission.delete_all", this.target)))
                .catch((e) => {
                    this.message.reply(__("permissions.group.permission.failed_to_delete_all", this.target));
                    Application.getLogger().error("Unable to delete all permissions", {cause: e});
                });
        });
        confirmation.run();
    }

    private async getGroupId() {
        let group_name = this.target;
        let group_id = await Application.getModuleManager().getModule(GroupsModule).getGroupId(this.message.getChannel(), group_name);

        if (group_id < 0) {
            await this.message.reply("Group not found: " + group_name);
            return null;
        }

        return group_id;
    }
}