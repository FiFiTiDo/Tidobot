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
import {CommandEvent, CommandEventArgs} from "../Systems/Commands/CommandEvent";
import Command from "../Systems/Commands/Command";
import {integer} from "../Systems/Commands/Validator/Integer";
import {InvalidInputError} from "../Systems/Commands/Validator/ValidationErrors";
import {onePartConverter} from "../Systems/Commands/Validator/Converter";
import {string} from "../Systems/Commands/Validator/String";
import StandardValidationStrategy from "../Systems/Commands/Validator/Strategies/StandardValidationStrategy";
import {ValidatorStatus} from "../Systems/Commands/Validator/Strategies/ValidationStrategy";

const listConverter = onePartConverter("list name", "list", true, null, async (part, column, msg) => {
    const list = await ListsEntity.findByName(part, msg.getChannel());
    if (list === null)
        throw new InvalidInputError(await msg.getResponse().translate("lists:unknown", {list: part}));
    return list;
});

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

        const {status, args} = await event.validate(new StandardValidationStrategy<[ListsEntity, number]>({
            usage: "list <list name> [item number]",
            arguments: [
                listConverter,
                integer({name: "item number", required: false})
            ],
            permission: args => args.length > 1 ? "list.view.specific" : "list.view.random"
        }));
        if (status !== ValidatorStatus.OK) return;
        const list = args[0];

        let item: ListEntity;
        if (args.length > 1) {
            const itemNum = args[1];

            item = await list.getItem(itemNum);
            if (item === null) {
                await response.message("lists:item.unknown", {number: itemNum});
                return;
            }
        } else {
            const items = await list.getAllItems();

            if (items.length < 1) {
                await msg.getResponse().message("lists:empty", {list: list.name});
                return;
            }

            item = array_rand(items);
        }

        await msg.getResponse().message("#" + item.id + ": " + item.value);
    }

    async create({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {status, args} = await event.validate(new StandardValidationStrategy({
            usage: "list create <list name>",
            arguments: [
                string({name: "list name", required: true})
            ],
            permission: "list.create"
        }));
        if (status !== ValidatorStatus.OK) return;
        const [name] = args;

        try {
            const list = await ListsEntity.create(name, msg.getChannel());
            await response.message(list === null ? "lists:exists" : "lists:created", {list: name});
        } catch (e) {
            await response.genericError();
        }
    }

    async delete({event, response}: CommandEventArgs): Promise<void> {
        const {status, args} = await event.validate(new StandardValidationStrategy({
            usage: "list delete <list name>",
            arguments: [
                listConverter
            ],
            permission: "list.delete"
        }));
        if (status !== ValidatorStatus.OK) return;
        const list: ListsEntity = args[0];

        try {
            await list.delete();
            await response.message("lists:deleted", {list: name});
        } catch (e) {
            await response.genericError();
        }
    }

    async add({event, response}: CommandEventArgs): Promise<void> {
        const {status, args} = await event.validate(new StandardValidationStrategy<[ListsEntity, string]>({
            usage: "list add <list name> <item>",
            arguments: [
                listConverter,
                string({name: "value", required: true, greedy: true})
            ],
            permission: "list.delete"
        }));
        if (status !== ValidatorStatus.OK) return;
        const [list, value] = args;
        const item = await list.addItem(value);
        if (item === null) {
            await response.genericError();
        } else {
            await response.message("lists:item.added", {number: item.id});
        }
    }

    async edit({event, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy<[ListsEntity, number, string]>({
            usage: "list edit <list name> <item number> <new value>",
            arguments: [
                listConverter,
                integer({name: "item number", required: true}),
                string({name: "new value", required: true, greedy: true})
            ],
            permission: "list.edit"
        }));
        if (status !== ValidatorStatus.OK) return;
        const [list, itemNum, value] = args;
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
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "list remove <list name> <item number>",
            arguments: [
                listConverter,
                integer({name: "item number", required: true})
            ],
            permission: "list.add"
        }));
        if (status !== ValidatorStatus.OK) return;
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