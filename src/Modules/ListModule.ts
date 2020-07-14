import AbstractModule, {ModuleInfo, Symbols, Systems} from "./AbstractModule";
import ListsEntity from "../Database/Entities/ListsEntity";
import ListEntity from "../Database/Entities/ListEntity";
import {tuple} from "../Utilities/ArrayUtils";
import {Role} from "../Systems/Permissions/Role";
import Permission from "../Systems/Permissions/Permission";
import {NewChannelEvent, NewChannelEventArgs} from "../Chat/Events/NewChannelEvent";
import {EventHandler, HandlesEvents} from "../Systems/Event/decorators";
import CommandSystem from "../Systems/Commands/CommandSystem";
import {CommandEvent, CommandEventArgs} from "../Systems/Commands/CommandEvent";
import Command from "../Systems/Commands/Command";
import {integer} from "../Systems/Commands/Validation/Integer";
import {string} from "../Systems/Commands/Validation/String";
import StandardValidationStrategy from "../Systems/Commands/Validation/Strategies/StandardValidationStrategy";
import {ValidatorStatus} from "../Systems/Commands/Validation/Strategies/ValidationStrategy";
import {entity} from "../Systems/Commands/Validation/Entity";
import {getLogger} from "../Utilities/Logger";
import {command, Subcommand} from "../Systems/Commands/decorators";
import Message from "../Chat/Message";
import {ExpressionContextResolver} from "../Systems/Expressions/decorators";
import {permission} from "../Systems/Permissions/decorators";

export const MODULE_INFO = {
    name: "List",
    version: "1.0.2",
    description: "Keep lists of different things like quotes or gifs"
};

const logger = getLogger(MODULE_INFO.name);

class ListCommand extends Command {
    constructor(private listModule: ListModule) {
        super("list", "<create|delete|add|edit|remove>");
    }

    async execute(eventArgs: CommandEventArgs): Promise<void> {
        if (await super.executeSubcommands(eventArgs)) return;

        const {event, message: msg, response} = eventArgs;

        const {status, args} = await event.validate(new StandardValidationStrategy<[ListsEntity, number]>({
            usage: "list <list name> [item number]",
            arguments: tuple(
                entity({
                    name: "list name",
                    entity: ListsEntity,
                    required: true,
                    error: {msgKey: "lists:unknown", optionKey: "list"}
                }),
                integer({name: "item number", required: false})
            ),
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
            item = await list.getRandomItem();

            if (item === null) {
                await msg.getResponse().message("lists:empty", {list: list.name});
                return;
            }
        }

        await msg.getResponse().message("#" + item.id + ": " + item.value);
    }

    @Subcommand("create")
    async create({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {status, args} = await event.validate(new StandardValidationStrategy({
            usage: "list create <list name>",
            subcommand: "create",
            arguments: tuple(
                string({name: "list name", required: true})
            ),
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

    @Subcommand("delete", "del")
    async delete({event, response}: CommandEventArgs): Promise<void> {
        const {status, args} = await event.validate(new StandardValidationStrategy({
            usage: "list delete <list name>",
            subcommand: "delete",
            arguments: tuple(
                entity({
                    name: "list name",
                    entity: ListsEntity,
                    required: true,
                    error: {msgKey: "lists:unknown", optionKey: "list"}
                }),
            ),
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

    @Subcommand("add")
    async add({event, response}: CommandEventArgs): Promise<void> {
        const {status, args} = await event.validate(new StandardValidationStrategy<[ListsEntity, string]>({
            usage: "list add <list name> <item>",
            subcommand: "add",
            arguments: tuple(
                entity({
                    name: "list name",
                    entity: ListsEntity,
                    required: true,
                    error: {msgKey: "lists:unknown", optionKey: "list"}
                }),
                string({name: "value", required: true, greedy: true})
            ),
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

    @Subcommand("edit")
    async edit({event, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy<[ListsEntity, number, string]>({
            usage: "list edit <list name> <item number> <new value>",
            subcommand: "edit",
            arguments: tuple(
                entity({
                    name: "list name",
                    entity: ListsEntity,
                    required: true,
                    error: {msgKey: "lists:unknown", optionKey: "list"}
                }),
                integer({name: "item number", required: true}),
                string({name: "new value", required: true, greedy: true})
            ),
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

    @Subcommand("remove", "rem")
    async remove({event, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "list remove <list name> <item number>",
            subcommand: "remove",
            arguments: tuple(
                entity({
                    name: "list name",
                    entity: ListsEntity,
                    required: true,
                    error: {msgKey: "lists:unknown", optionKey: "list"}
                }),
                integer({name: "item number", required: true})
            ),
            permission: "list.add"
        }));
        if (status !== ValidatorStatus.OK) return;
        const [list, itemNum] = args;
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

@HandlesEvents()
export default class ListModule extends AbstractModule {
    static [Symbols.ModuleInfo] = MODULE_INFO;

    constructor() {
        super(ListModule);
    }

    @command listCommand = new ListCommand(this);

    @permission createList = new Permission("list.create", Role.MODERATOR);
    @permission deleteList = new Permission("list.delete", Role.MODERATOR);
    @permission addToList = new Permission("list.add", Role.MODERATOR);
    @permission editItem = new Permission("list.edit", Role.MODERATOR);
    @permission removeFromList = new Permission("list.remove", Role.MODERATOR);
    @permission viewItem = new Permission("list.view", Role.NORMAL);
    @permission viewSpecificItem = new Permission("list.view.specific", Role.NORMAL);

    @ExpressionContextResolver
    expressionContextResolver(msg: Message) {
        return {
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
                        const event = new CommandEvent(command, args, msg.extend(raw, resolve), this.listCommand);
                        this.listCommand.execute(event.getEventArgs());
                    });
                }
            }
        }
    }

    @EventHandler(NewChannelEvent)
    async onNewChannel({channel}: NewChannelEventArgs): Promise<void> {
        await ListsEntity.createTable({channel});
    }
}