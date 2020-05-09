import AbstractModule from "./AbstractModule";
import Message from "../Chat/Message";
import ListsEntity from "../Database/Entities/ListsEntity";
import ListEntity from "../Database/Entities/ListEntity";
import {array_rand} from "../Utilities/ArrayUtils";
import PermissionSystem from "../Systems/Permissions/PermissionSystem";
import {Role} from "../Systems/Permissions/Role";
import Permission from "../Systems/Permissions/Permission";
import {Key} from "../Utilities/Translator";
import {NewChannelEvent, NewChannelEventArgs} from "../Chat/Events/NewChannelEvent";
import {EventHandler, HandlesEvents} from "../Systems/Event/decorators";
import ExpressionSystem from "../Systems/Expressions/ExpressionSystem";
import CommandSystem from "../Systems/Commands/CommandSystem";
import {CommandEvent, CommandEventArgs} from "../Systems/Commands/CommandEvent";
import Command from "../Systems/Commands/Command";

@HandlesEvents()
export default class ListModule extends AbstractModule {
    constructor() {
        super(ListModule.name);
    }

    initialize(): void {
        const cmd = CommandSystem.getInstance();
        const listCommand = new ListCommand();
        cmd.registerCommand(listCommand, this);

        const perm = PermissionSystem.getInstance();
        perm.registerPermission(new Permission("list.create", Role.MODERATOR));
        perm.registerPermission(new Permission("list.delete", Role.MODERATOR));
        perm.registerPermission(new Permission("list.add", Role.MODERATOR));
        perm.registerPermission(new Permission("list.edit", Role.MODERATOR));
        perm.registerPermission(new Permission("list.remove", Role.MODERATOR));
        perm.registerPermission(new Permission("list.view", Role.NORMAL));
        perm.registerPermission(new Permission("list.view.specific", Role.NORMAL));
        perm.registerPermission(new Permission("list.view.random", Role.NORMAL));

        ExpressionSystem.getInstance().registerResolver(msg => ({
            list: {
                command: async (listName: unknown): Promise<string> => {
                    if (typeof listName !== "string") return "Invalid parameter, expected a string";
                    const prefix = await CommandSystem.getPrefix(msg.getChannel());
                    return new Promise((resolve) => {
                        let args = [];
                        if (msg.getParts().length < 1) {
                            args.push(listName);
                        } else {
                            const subcmd = msg.getPart(0);
                            switch (subcmd.toLowerCase()) {
                                case "create":
                                case "delete":
                                    resolve("Cannot create or delete list using alias");
                                    return;
                                case "add":
                                case "edit":
                                case "remove":
                                    args.push(subcmd);
                                    args.push(listName);
                                    args = args.concat(msg.getParts().slice(1));
                                    break;
                                default:
                                    args.push(listName);
                                    args = args.concat(msg.getParts());
                            }
                        }
                        const command = `${prefix}list`;
                        const event = new CommandEvent(command, args, msg.extend(`${command} ${args.join(" ")}`, resolve));
                        listCommand.execute(event.getEventArgs());
                    });
                }
            }
        }));
    }

    public static async listNameArgConverter(raw: string, msg: Message): Promise<ListsEntity|null> {
        const list = await ListsEntity.findByName(raw, msg.getChannel());
        if (list === null) await msg.getResponse().message(Key("lists.unknown"), raw);
        return list;
    }

    @EventHandler(NewChannelEvent)
    async onNewChannel({ channel }: NewChannelEventArgs): Promise<void> {
        await ListsEntity.createTable({ channel });
    }
}

class ListCommand extends Command {
    constructor() {
        super("list", "<create|delete|add|edit|remove>");

        this.addSubcommand("create", this.create);
        this.addSubcommand("delete", this.delete);
        this.addSubcommand("del", this.delete);
        this.addSubcommand("add", this.add);
        this.addSubcommand("edit", this.edit);
        this.addSubcommand("remove", this.remove);
        this.addSubcommand("rem", this.remove);
    }

    async execute(eventArgs: CommandEventArgs): Promise<void> {
        if (super.executeSubcommands(eventArgs)) return;

        const {event, message: msg, response} = eventArgs;
        const args = await event.validate({
            usage: "list <list name> [item number]",
            arguments: [
                {
                    value: {
                        type: "custom",
                        converter: ListModule.listNameArgConverter
                    },
                    required: true
                },
                {
                    value: {
                        type: "integer",
                    },
                    required: false
                }
            ],
            permission: "list.view"
        });
        if (args === null) return;
        const list: ListsEntity = args[0];

        let item: ListEntity;
        if (args.length > 1) {
            if (!await msg.checkPermission("list.view.specific")) return;
            const itemNum = args[1];

            item = await list.getItem(itemNum);
            if (item === null) {
                await response.message(Key("lists.item.unknown"), item);
                return;
            }
        } else {
            if (!await msg.checkPermission("list.view.random")) return;

            item = array_rand(await list.getAllItems());
        }

        await msg.getResponse().message("#" + item.id + ": " + item.value);
    }

    async create({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "list create <list name>",
            arguments: [
                {
                    value: {
                        type: "string",
                    },
                    required: true
                }
            ],
            permission: "list.create"
        });
        if (args === null) return;
        const [name] = args;

        try {
            const list = await ListsEntity.create(name, msg.getChannel());
            if (list === null) {
                await response.message(Key("lists.create.already_exists"), name);
            } else {
                await response.message(Key("lists.create.successful"), name);
            }
        } catch (e) {
            await response.message(Key("lists.create.failed"), name);
        }
    }

    async delete({event, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "list delete <list name>",
            arguments: [
                {
                    value: {
                        type: "custom",
                        converter: ListModule.listNameArgConverter
                    },
                    required: true
                }
            ],
            permission: "list.delete"
        });
        if (args === null) return;
        const list: ListsEntity = args[0];

        try {
            await list.delete();
            await response.message(Key("lists.delete.successful"), name);
        } catch (e) {
            await response.message(Key("lists.delete.failed"), name);
        }
    }

    async add({event, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "list add <list name> <item>",
            arguments: [
                {
                    value: {
                        type: "custom",
                        converter: ListModule.listNameArgConverter
                    },
                    required: true
                },
                {
                    value: {
                        type: "string",
                    },
                    required: true,
                    greedy: true
                }
            ],
            permission: "list.delete"
        });
        if (args === null) return;
        const [list, value] = args as [ListsEntity, string];
        const item = await list.addItem(value);
        if (item === null) {
            await response.message(Key("lists.item.add.failed"));
        } else {
            await response.message(Key("lists.item.add.successful"), item.id);
        }
    }

    async edit({event, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "list edit <list name> <item number> <new value>",
            arguments: [
                {
                    value: {
                        type: "custom",
                        converter: ListModule.listNameArgConverter
                    },
                    required: true
                },
                {
                    value: {
                        type: "integer",
                    },
                    required: true
                },
                {
                    value: {
                        type: "string",
                    },
                    required: true,
                    greedy: true
                }
            ],
            permission: "list.edit"
        });
        if (args === null) return;
        const [list, itemNum, value ] = args as [ListsEntity, number, string];
        const item = await list.getItem(itemNum);
        if (item === null) {
            await response.message(Key("lists.item.unknown"), item);
        } else {
            try {
                item.value = value;
                await item.save();
                await response.message(Key("lists.item.edit.successful"), item.id);
            } catch (e) {
                await response.message(Key("lists.item.edit.failed"));
            }
        }
    }

    async remove({event, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "list remove <list name> <item number>",
            arguments: [
                {
                    value: {
                        type: "custom",
                        converter: ListModule.listNameArgConverter
                    },
                    required: true
                },
                {
                    value: {
                        type: "integer",
                    },
                    required: true
                }
            ],
            permission: "list.add"
        });
        if (args === null) return;
        const [list, itemNum] = args as [ListsEntity, number];
        const item = await list.getItem(itemNum);
        if (item === null) {
            await response.message(Key("lists.item.unknown"), item);
        } else {
            try {
                await item.delete();
                await response.message(Key("lists.item.delete.successful"), item.id);
            } catch (e) {
                await response.message(Key("lists.item.delete.failed"));
            }
        }
    }
}