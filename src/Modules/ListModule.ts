import AbstractModule from "./AbstractModule";
import PermissionModule, {PermissionLevel} from "./PermissionModule";
import CommandModule, {CommandEvent, SubcommandHelper} from "./CommandModule";
import Channel from "../Chat/Channel";
import Application from "../Application/Application";
import {__, array_rand} from "../Utilities/functions";
import ChannelSchemaBuilder from "../Database/ChannelSchemaBuilder";
import Message from "../Chat/Message";
import ExpressionModule from "./ExpressionModule";
import ListsEntity from "../Database/Entities/ListsEntity";
import Entity from "../Database/Entities/Entity";
import ListEntity from "../Database/Entities/ListEntity";

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

    private async listNameArgConverter(raw: string, msg: Message) {
        let list = await ListsEntity.findByName(raw, this.getServiceName(), msg.getChannel().getName());
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
                    converter: this.listNameArgConverter
                },
                {
                    type: "integer",
                    required: false
                }
            ],
            permission: "list.view"
        });
        if (args === null) return;
        let list: ListsEntity = args[0];

        let item: ListEntity;
        if (args.length > 1) {
            if (!await msg.checkPermission("list.view.specific")) return;
            let itemNum = args[1];

            item = await list.getItem(itemNum);
            if (item === null) {
                await msg.reply(__("lists.item.unknown", item));
                return;
            }
        } else {
            if (!await msg.checkPermission("list.view.random")) return;

            item = array_rand(await list.getAllItems());
        }

        await msg.reply("#" + item.id + ": " + item.value);
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
            let list = await ListsEntity.create(name, this.getServiceName(), msg.getChannel().getName());
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
                    converter: this.listNameArgConverter
                }
            ],
            permission: "list.delete"
        });
        if (args === null) return;
        let list: ListsEntity = args[0];

        try {
            await list.delete();
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
                    converter: this.listNameArgConverter
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
        let [list, value] = args as [ListsEntity, string];

        let item = await list.addItem(value);
        if (item === null) {
            await msg.reply(__("lists.item.add.failed"));
        } else {
            await msg.reply(__("lists.item.add.successful", item.id));
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
                    converter: this.listNameArgConverter
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
        let [list, itemNum, value ] = args as [ListsEntity, number, string];

        let item = await list.getItem(itemNum);
        if (item === null) {
            await msg.reply(__("lists.item.unknown", item));
        } else {
            try {
                item.value = value;
                await item.save();
                await msg.reply(__("lists.item.edit.successful", item.id));
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
                    converter: this.listNameArgConverter
                },
                {
                    type: "integer",
                    required: true
                }
            ],
            permission: "list.add"
        });
        if (args === null) return;
        let [list, itemNum] = args as [ListsEntity, number];

        let item = await list.getItem(itemNum);
        if (item === null) {
            await msg.reply(__("lists.item.unknown", item));
        } else {
            try {
                await item.delete();
                await msg.reply(__("lists.item.delete.successful", item.id));
            } catch (e) {
                await msg.reply(__("lists.item.delete.failed"));
            }
        }
    };
}