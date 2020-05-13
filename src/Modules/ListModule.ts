import AbstractModule from "./AbstractModule";
import Message from "../Chat/Message";
import ListsEntity from "../Database/Entities/ListsEntity";
import ListEntity from "../Database/Entities/ListEntity";
import {array_rand} from "../Utilities/ArrayUtils";
import PermissionSystem from "../Systems/Permissions/PermissionSystem";
import {Role} from "../Systems/Permissions/Role";
import Permission from "../Systems/Permissions/Permission";
import {NewChannelEvent, NewChannelEventArgs} from "../Chat/Events/NewChannelEvent";
import {EventHandler, HandlesEvents} from "../Systems/Event/decorators";
import ExpressionSystem from "../Systems/Expressions/ExpressionSystem";
import CommandSystem from "../Systems/Commands/CommandSystem";
import {CommandEvent, CommandEventArgs, ValidatorResponse} from "../Systems/Commands/CommandEvent";
import Command from "../Systems/Commands/Command";

@HandlesEvents()
export default class ListModule extends AbstractModule {
    constructor() {
        super(ListModule.name);
    }

    public static async listNameArgConverter(raw: string, msg: Message): Promise<ListsEntity | ValidatorResponse> {
        const list = await ListsEntity.findByName(raw, msg.getChannel());
        if (list === null) {
            await msg.getResponse().message("lists:unknown", {list: raw});
            return ValidatorResponse.RESPONDED;
        }
        return list;
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
                    const origArgs = msg.getParts().slice(1);
                    return new Promise((resolve) => {
                        let args = [];
                        if (origArgs.length < 1) {
                            args.push(listName);
                        } else {
                            const subcmd = origArgs[0];
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
                                    args = args.concat(origArgs.slice(1));
                                    break;
                                default:
                                    args.push(listName);
                                    args = args.concat(origArgs);
                            }
                        }
                        const command = `${prefix}list`;
                        const raw = `${command} ${args.join(" ")}`;
                        const event = new CommandEvent(command, args, msg.extend(raw, resolve));
                        listCommand.execute(event.getEventArgs());
                    });
                }
            }
        }));
    }

    @EventHandler(NewChannelEvent)
    async onNewChannel({channel}: NewChannelEventArgs): Promise<void> {
        await ListsEntity.createTable({channel});
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
        if (await super.executeSubcommands(eventArgs)) return;

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
                await response.message("lists:item.unknown", {number: itemNum});
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
            await response.message(list === null ? "lists:exists" : "lists:created", {list: name});
        } catch (e) {
            await response.genericError();
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
            await response.message("lists:deleted", {list: name});
        } catch (e) {
            await response.genericError();
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
            await response.genericError();
        } else {
            await response.message("lists:item.added", {number: item.id});
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
        const [list, itemNum, value] = args as [ListsEntity, number, string];
        const item = await list.getItem(itemNum);
        if (item === null) {
            await response.message("lists:item.unknown", {number: itemNum});
        } else {
            try {
                item.value = value;
                await item.save();
                await response.message("lists:item.edited", {number: item.id});
            } catch (e) {
                await response.genericError();
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
            await response.message("lists:item.unknown", {number: itemNum});
        } else {
            try {
                await item.delete();
                await response.message("lists:item.deleted", {number: item.id});
            } catch (e) {
                await response.genericError();
            }
        }
    }
}