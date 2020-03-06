import AbstractModule from "./AbstractModule";
import PermissionModule, {PermissionLevel} from "./PermissionModule";
import CommandModule, {CommandEvent, SubcommandHelper} from "./CommandModule";
import Channel from "../Chat/Channel";
import Application from "../Application/Application";
import {__, array_rand} from "../Utilities/functions";
import ChannelSchemaBuilder from "../Database/ChannelSchemaBuilder";
import Message from "../Chat/Message";
import ExpressionModule from "./ExpressionModule";

export default class ListModule extends AbstractModule {
    constructor() {
        super(ListModule.name);
    }

    initialize() {
        let cmd = this.getModuleManager().getModule(CommandModule);
        cmd.registerCommand("list", this.listCommand, this);

        let perm = this.getModuleManager().getModule(PermissionModule);
        perm.registerPermission("list.create", PermissionLevel.MODERATOR);
        perm.registerPermission("list.delete", PermissionLevel.MODERATOR);
        perm.registerPermission("list.add", PermissionLevel.MODERATOR);
        perm.registerPermission("list.edit", PermissionLevel.MODERATOR);
        perm.registerPermission("list.remove", PermissionLevel.MODERATOR);
        perm.registerPermission("list.view", PermissionLevel.NORMAL);
        perm.registerPermission("list.view.specific", PermissionLevel.NORMAL);
        perm.registerPermission("list.view.random", PermissionLevel.NORMAL);

        this.getModuleManager().getModule(ExpressionModule).registerResolver(msg => {

            return {
                list: {
                    command: async (list_name: unknown) => {
                        if (typeof list_name !== "string") return "Invalid parameter, expected a string";
                        return new Promise(async (resolve, reject) => {
                            let args = [];
                            let prefix = await this.getModuleManager().getModule(CommandModule).getPrefix(msg.getChannel());
                            if (msg.getParts().length < 1) {
                                args.push(list_name);
                            } else {
                                let subcmd = msg.getPart(0);
                                switch (subcmd.toLowerCase()) {
                                    case "create":
                                    case "delete":
                                        resolve("Cannot create or delete list using alias");
                                        return;
                                    case "add":
                                    case "edit":
                                    case "remove":
                                        args.push(subcmd);
                                        args.push(list_name);
                                        args = args.concat(msg.getParts().slice(1));
                                        break;
                                    default:
                                        args.push(list_name);
                                        args = args.concat(msg.getParts());
                                }
                            }
                            this.listCommand(new CommandEvent(prefix + "list", args, msg.extend(prefix + "list" + args.join(" "), resolve)));
                        });
                    }
                }
            }
        })
    }

    createDatabaseTables(builder: ChannelSchemaBuilder) {
        builder.addTable("lists", table => {
            table.string('name').unique();
        });
    }

    async listCommand(event: CommandEvent) {
        new SubcommandHelper.Builder()
            .addSubcommand("create", this.create)
            .addSubcommand("delete", this.delete)
            .addSubcommand("add", this.add)
            .addSubcommand("edit", this.edit)
            .addSubcommand("remove", this.remove)
            .onDefault(this.retrieve)
            .build(this)
            .handle(event);
    }

    private static async listNameArgConverter(raw: string, msg: Message) {
        let list = await List.retrieve(raw, msg.getChannel());
        if (list === null) await msg.reply(__("lists.unknown", raw));
        return list;
    }

    async retrieve(event: CommandEvent) {
        let msg = event.getMessage();
        let args = await event.validate({
            usage: "list <list name> [item number]",
            arguments: [
                {
                    type: "custom",
                    required: true,
                    converter: ListModule.listNameArgConverter
                },
                {
                    type: "integer",
                    required: false
                }
            ],
            permission: "list.view"
        });
        if (args === null) return;
        let list: List = args[0];

        let item;
        if (args.length > 1) {
            if (!await msg.checkPermission("list.view.specific")) return;
            let itemNum = args[1];

            item = await list.get(itemNum);
            if (item === null) {
                await msg.reply(__("lists.item.unknown", item));
                return;
            }
        } else {
            if (!await msg.checkPermission("list.view.random")) return;

            item = array_rand(await list.getAll());
        }

        await msg.reply("#" + item.getId() + ": " + item.getValue());
    }

    async create(event: CommandEvent) {
        let msg = event.getMessage();
        let args = await event.validate({
            usage: "list create <list name>",
            arguments: [
                {
                    type: "string",
                    required: true
                }
            ],
            permission: "list.create"
        });
        if (args === null) return;
        let [name] = args;

        try {
            let list = await List.make(name, msg.getChannel());
            if (list === null) {
                await msg.reply(__("lists.create.already_exists", name));
            } else {
                await msg.reply(__("lists.create.successful", name));
            }
        } catch (e) {
            await msg.reply(__("lists.create.failed", name));
        }
    };

    async delete(event: CommandEvent) {
        let msg = event.getMessage();
        let args = await event.validate({
            usage: "list delete <list name>",
            arguments: [
                {
                    type: "custom",
                    required: true,
                    converter: ListModule.listNameArgConverter
                }
            ],
            permission: "list.delete"
        });
        if (args === null) return;
        let list: List = args[0];

        try {
            await list.del();
            await msg.reply(__("lists.delete.successful", name));
        } catch (e) {
            await msg.reply(__("lists.delete.failed", name));
        }
    };

    async add(event: CommandEvent) {
        let msg = event.getMessage();
        let args = await event.validate({
            usage: "list add <list name> <item>",
            arguments: [
                {
                    type: "custom",
                    required: true,
                    converter: ListModule.listNameArgConverter
                },
                {
                    type: "string",
                    required: true,
                    greedy: true
                }
            ],
            permission: "list.delete"
        });
        if (args === null) return;
        let list: List = args[0];
        let value = args[1];

        let item = await list.add(value);
        if (item === null) {
            await msg.reply(__("lists.item.add.failed"));
        } else {
            await msg.reply(__("lists.item.add.successful", item.getId()));
        }
    };

    async edit(event: CommandEvent) {
        let msg = event.getMessage();
        let args = await event.validate({
            usage: "list edit <list name> <item number> <new value>",
            arguments: [
                {
                    type: "custom",
                    required: true,
                    converter: ListModule.listNameArgConverter
                },
                {
                    type: "integer",
                    required: true
                },
                {
                    type: "string",
                    required: true,
                    greedy: true
                }
            ],
            permission: "list.edit"
        });
        if (args === null) return;
        let [, itemNum, value ] = args;
        let list: List = args[0];

        let item = await list.get(itemNum);
        if (item === null) {
            await msg.reply(__("lists.item.unknown", item));
        } else {
            try {
                await item.setValue(value);
                await msg.reply(__("lists.item.edit.successful", item.getId()));
            } catch (e) {
                await msg.reply(__("lists.item.edit.failed"));
            }
        }
    };

    async remove(event: CommandEvent) {
        let msg = event.getMessage();
        let args = await event.validate({
            usage: "list remove <list name> <item number>",
            arguments: [
                {
                    type: "custom",
                    required: true,
                    converter: ListModule.listNameArgConverter
                },
                {
                    type: "integer",
                    required: true
                }
            ],
            permission: "list.add"
        });
        if (args === null) return;
        let [, itemNum ] = args;
        let list: List = args[0];

        let item = await list.get(itemNum);
        if (item === null) {
            await msg.reply(__("lists.item.unknown", item));
        } else {
            try {
                await item.del();
                await msg.reply(__("lists.item.delete.successful", item.getId()));
            } catch (e) {
                await msg.reply(__("lists.item.delete.failed"));
            }
        }
    };
}

class List {
    private readonly id: number;
    private readonly name: string;
    private readonly channel: Channel;

    constructor(id: number, name: string, channel: Channel) {
        this.id = id;
        this.name = name;
        this.channel = channel;
    }

    static async make(name: string, channel: Channel) {
        let count = await channel.query("lists").count().where().eq("name", name).done().exec();
        if (count > 0) return null;
        let resp = await channel.query("lists").insert({name}).exec();
        if (resp.length < 1) throw new Error("Unable to add list to the database");
        let list = new List(resp[0], name, channel);
        await Application.getDatabase().table(list.getTableName()).create((table) => {
            table.string("value");
        }).ifNotExists().exec();
        return list;
    }

    static async retrieve(name: string, channel: Channel) {
        let rows = await channel.query("lists").select().where().eq("name", name).done().all();
        if (rows.length < 1) return null;
        return new List(rows[0].id, rows[0].name, channel);
    }

    async add(value: string) {
        return ListItem.make(value, this);
    }

    async get(i: number) {
        return ListItem.retrieve(i, this);
    }

    async getAll() {
        let rows = await this.query().select().all();
        return rows.map(row => new ListItem(row.id, row.value, this));
    }

    async del() {
        return this.channel.query("lists")
            .delete()
            .where().eq("id", this.id).done()
            .exec()
            .then(() => Application.getDatabase().table(this.getTableName()).drop().exec());
    }

    getName() {
        return this.name;
    }

    query() {
        return Application.getDatabase().table(this.getTableName());
    }

    private getTableName() {
        return this.channel.getName() + "_list_" + this.getName();
    }
}

class ListItem {
    private readonly id: number;
    private readonly parent: List;
    private value: string;

    constructor(id: number, value: string, parent: List) {
        this.id = id;
        this.value = value;
        this.parent = parent;
    }

    static async make(value: string, parent: List) {
        let resp = await parent.query().insert({value}).exec();
        if (resp.length < 0) throw new Error("No list item inserted into the database.");
        return new ListItem(resp[0], value, parent);
    }

    static async retrieve(id: number, parent: List) {
        let rows = await parent.query().select().where().eq("id", id).done().all();
        if (rows.length < 1) return null;

        return new ListItem(id, rows[0].value, parent);
    }

    getId() {
        return this.id;
    }

    getValue() {
        return this.value;
    }

    async setValue(value: string) {
        this.value = value;
        await this.save();
    }

    async del() {
        return this.parent.query().delete().where().eq("id", this.id).done().exec();
    }

    async save() {
        return this.parent.query().insert({ id: this.id, value: this.value }).or("REPLACE").exec();
    }
}