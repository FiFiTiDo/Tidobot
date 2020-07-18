import AbstractModule, {Symbols} from "./AbstractModule";
import ListsEntity from "../Database/Entities/ListsEntity";
import {Role} from "../Systems/Permissions/Role";
import Permission from "../Systems/Permissions/Permission";
import {NewChannelEvent, NewChannelEventArgs} from "../Chat/Events/NewChannelEvent";
import {EventHandler, HandlesEvents} from "../Systems/Event/decorators";
import CommandSystem from "../Systems/Commands/CommandSystem";
import {CommandEvent} from "../Systems/Commands/CommandEvent";
import Command from "../Systems/Commands/Command";
import {IntegerArg} from "../Systems/Commands/Validation/Integer";
import {StringArg} from "../Systems/Commands/Validation/String";
import {EntityArg} from "../Systems/Commands/Validation/Entity";
import {getLogger} from "../Utilities/Logger";
import {command} from "../Systems/Commands/decorators";
import Message from "../Chat/Message";
import {ExpressionContextResolver} from "../Systems/Expressions/decorators";
import {permission} from "../Systems/Permissions/decorators";
import {CommandHandler} from "../Systems/Commands/Validation/CommandHandler";
import CheckPermission from "../Systems/Commands/Validation/CheckPermission";
import {Argument, Channel, ResponseArg, RestArguments} from "../Systems/Commands/Validation/Argument";
import {Response} from "../Chat/Response";
import ChannelEntity from "../Database/Entities/ChannelEntity";
import {returnErrorAsync, validateFunction} from "../Utilities/ValidateFunction";

export const MODULE_INFO = {
    name: "List",
    version: "1.1.1",
    description: "Keep lists of different things like quotes or gifs"
};

const logger = getLogger(MODULE_INFO.name);
const ListArg = new EntityArg(ListsEntity, {msgKey: "lists:unknown", optionKey: "list"});

class ListCommand extends Command {
    constructor(private listModule: ListModule) {
        super("list", "<create|delete|add|edit|remove>");
    }

    @CommandHandler(/^list (?!create|delete|del|add|edit|remove|rem)/, "list <list> [item number]", 1)
    @CheckPermission(event => event.getArgumentCount() > 1 ? "list.view.specific" : "list.view.random")
    async handleCommand(
        event: CommandEvent, @ResponseArg response: Response, @Argument(ListArg) list: ListsEntity,
        @Argument(new IntegerArg({ min: 0 }), "item number", false) itemNum: number = null
    ): Promise<void> {
        const random = itemNum === null;
        const item = random ? await list.getRandomItem() : await list.getItem(itemNum);
        if (random) return await response.message(random ? "lists:empty" : "lists:item.unknown", {
            number: itemNum, list: list.name
        });
        return await response.rawMessage("#" + item.id + ": " + item.value);
    }

    @CommandHandler("list create", "list create <name>", 1)
    @CheckPermission("list.create")
    async create(
        event: CommandEvent, @ResponseArg response: Response, @Channel channel: ChannelEntity, @Argument(StringArg) name: string
    ): Promise<void> {
        return ListsEntity.create(name, channel)
            .then(list => response.message(list === null ? "lists:exists" : "lists:created", {list: name}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^list del(ete)?/, "list delete <name>", 1)
    @CheckPermission("list.delete")
    async delete(event: CommandEvent, @ResponseArg response: Response, @Argument(ListArg) list: ListsEntity): Promise<void> {
        return list.delete()
            .then(() => response.message("lists:deleted", {list: list.name}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler("list add", "list add <list> <value>", 1)
    @CheckPermission("list.add")
    async add(
        event: CommandEvent, @ResponseArg response: Response, @Argument(ListArg) list: ListsEntity,
        @RestArguments(true, true) value: string
    ): Promise<void> {
        return list.addItem(value)
            .then(item => item === null ? response.genericError() : response.message("lists:item.added", {number: item.id}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler("list edit", "list edit <list> <item> <new value>", 1)
    @CheckPermission("list.edit")
    async edit(
        event: CommandEvent, @ResponseArg response: Response, @Argument(ListArg) list: ListsEntity,
        @Argument(new IntegerArg({ min: 0 }), "item number") itemNum: number,
        @RestArguments(true, true) value: string
    ): Promise<void> {
        try {
            const item = await list.getItem(itemNum);
            if (item === null) return await response.message("lists:item.unknown", {number: itemNum});
            item.value = value;
            return item.save()
                .then(() => response.message("lists:item.edited", {number: item.id}))
                .catch(e => response.genericErrorAndLog(e, logger));
        } catch (e) {
            return await response.genericErrorAndLog(e, logger);
        }
    }

    @CommandHandler(/^list rem(ove)?/, "list remove <list> <item number>", 1)
    @CheckPermission("list.remove")
    async remove(
        event: CommandEvent, @ResponseArg response: Response, @Argument(ListArg) list: ListsEntity,
        @Argument(new IntegerArg({ min: 0 }), "item number") itemNum: number
    ): Promise<void> {
        const item = await list.getItem(itemNum);
        if (item === null) return await response.message("lists:item.unknown", {number: itemNum});
        return item.delete()
            .then(() => response.message("lists:item.deleted", {number: item.id}))
            .catch(e => response.genericErrorAndLog(e, logger));
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
                command: validateFunction(async (listName: string): Promise<string> => {
                    const prefix = await CommandSystem.getPrefix(msg.getChannel());
                    const origArgs = msg.getParts().slice(1);
                    return new Promise((resolve) => {
                        let args = [];
                        if (origArgs.length < 1) {
                            args.push(listName);
                        } else {
                            const subCmd = origArgs[0].toLowerCase();
                            switch (subCmd) {
                                case "create":
                                case "delete":
                                    resolve("Cannot create or delete list using alias");
                                    return;
                                case "add":
                                case "edit":
                                case "remove":
                                    args.push(subCmd);
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
                }, ["string|required"], returnErrorAsync())
            }
        }
    }

    @EventHandler(NewChannelEvent)
    async onNewChannel({channel}: NewChannelEventArgs): Promise<void> {
        await ListsEntity.createTable({channel});
    }
}