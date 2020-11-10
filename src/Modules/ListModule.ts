import AbstractModule, {Symbols} from "./AbstractModule";
import {Role} from "../Systems/Permissions/Role";
import Permission from "../Systems/Permissions/Permission";
import CommandSystem from "../Systems/Commands/CommandSystem";
import {CommandEvent} from "../Systems/Commands/CommandEvent";
import Command from "../Systems/Commands/Command";
import {IntegerArg} from "../Systems/Commands/Validation/Integer";
import {StringArg} from "../Systems/Commands/Validation/String";
import {EntityArg} from "../Systems/Commands/Validation/Entity";
import {getLogger} from "../Utilities/Logger";
import Message from "../Chat/Message";
import {CommandHandler} from "../Systems/Commands/Validation/CommandHandler";
import CheckPermission from "../Systems/Commands/Validation/CheckPermission";
import {Argument, ChannelArg, ResponseArg, RestArguments} from "../Systems/Commands/Validation/Argument";
import {Response} from "../Chat/Response";
import {returnErrorAsync, validateFunction} from "../Utilities/ValidateFunction";
import { Service } from "typedi";
import { ListRepository } from "../Database/Repositories/ListRepository";
import { List } from "../Database/Entities/List";
import { Channel } from "../Database/Entities/Channel";
import { InjectRepository } from "typeorm-typedi-extensions";
import { ListItemRepository } from "../Database/Repositories/ListItemRepository";
import Event from "../Systems/Event/Event";

export const MODULE_INFO = {
    name: "List",
    version: "1.2.0",
    description: "Keep lists of different things like quotes or gifs"
};

const logger = getLogger(MODULE_INFO.name);
const ListArg = new EntityArg(ListRepository, {msgKey: "lists:unknown", optionKey: "list"});

@Service()
class ListCommand extends Command {
    constructor(
        @InjectRepository() private readonly listRepository: ListRepository,
        @InjectRepository() private readonly listItemRepository: ListItemRepository
    ) {
        super("list", "<create|delete|add|edit|remove>");
    }

    @CommandHandler(/^list (?!create|delete|del|add|edit|remove|rem)/, "list <list> [item number]", 1)
    @CheckPermission(event => event.extra.get(CommandEvent.EXTRA_ARGUMENTS).length > 1 ? ListModule.permissions.viewSpecificItem : ListModule.permissions.viewRandomItem)
    async handleCommand(
        event: Event, @ResponseArg response: Response, @Argument(ListArg) list: List,
        @Argument(new IntegerArg({min: 0}), "item number", false) itemNum: number = null
    ): Promise<void> {
        const random = itemNum === null;
        const item = random ? list.getRandomItem() : list.getItem(itemNum);
        if (item === null) return await response.message(random ? "lists:empty" : "lists:item.unknown", {
            number: itemNum, list: list.name
        });
        return await response.rawMessage("#" + item.id + ": " + item.content);
    }

    @CommandHandler("list create", "list create <name>", 1)
    @CheckPermission(() => ListModule.permissions.createList)
    async create(
        event: Event, @ResponseArg response: Response, @ChannelArg channel: Channel, @Argument(StringArg) name: string
    ): Promise<void> {
        return this.listRepository.create({ name, channel }).save()
            .then(list => response.message(list === null ? "lists:exists" : "lists:created", {list: name}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^list del(ete)?/, "list delete <name>", 1)
    @CheckPermission(() => ListModule.permissions.deleteList)
    async delete(event: Event, @ResponseArg response: Response, @Argument(ListArg) list: List): Promise<void> {
        return list.remove()
            .then(() => response.message("lists:deleted", {list: list.name}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler("list add", "list add <list> <value>", 1)
    @CheckPermission(() => ListModule.permissions.addToList)
    async add(
        event: Event, @ResponseArg response: Response, @Argument(ListArg) list: List,
        @RestArguments(true, {join: " "}) content: string
    ): Promise<void> {
        return this.listItemRepository.add(list, content)
            .then(item => item === null ? response.genericError() : response.message("lists:item.added", {number: item.id}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler("list edit", "list edit <list> <item> <new value>", 1)
    @CheckPermission(() => ListModule.permissions.editItem)
    async edit(
        event: Event, @ResponseArg response: Response, @Argument(ListArg) list: List,
        @Argument(new IntegerArg({min: 0}), "item number") itemNum: number,
        @RestArguments(true, {join: " "}) content: string
    ): Promise<void> {
        try {
            const item = list.getItem(itemNum);
            if (item === null) return await response.message("lists:item.unknown", {number: itemNum});
            item.content = content;
            return item.save()
                .then(() => response.message("lists:item.edited", {number: item.id}))
                .catch(e => response.genericErrorAndLog(e, logger));
        } catch (e) {
            return await response.genericErrorAndLog(e, logger);
        }
    }

    @CommandHandler(/^list rem(ove)?/, "list remove <list> <item number>", 1)
    @CheckPermission(() => ListModule.permissions.removeFromList)
    async remove(
        event: Event, @ResponseArg response: Response, @Argument(ListArg) list: List,
        @Argument(new IntegerArg({min: 0}), "item number") itemNum: number
    ): Promise<void> {
        const item = list.getItem(itemNum);
        if (item === null) return await response.message("lists:item.unknown", {number: itemNum});
        return item.remove()
            .then(() => response.message("lists:item.deleted", {number: item.id}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }
}

export default class ListModule extends AbstractModule {
    static [Symbols.ModuleInfo] = MODULE_INFO;
    static permissions = {
        createList: new Permission("list.create", Role.MODERATOR),
        deleteList: new Permission("list.delete", Role.MODERATOR),
        addToList: new Permission("list.add", Role.MODERATOR),
        editItem: new Permission("list.edit", Role.MODERATOR),
        removeFromList: new Permission("list.remove", Role.MODERATOR),
        viewRandomItem: new Permission("list.view.random", Role.NORMAL),
        viewSpecificItem: new Permission("list.view.specific", Role.NORMAL)
    }

    constructor(private readonly listCommand: ListCommand) {
        super(ListModule);

        this.registerCommand(listCommand);
        this.registerPermissions(ListModule.permissions);
        this.registerExpressionContextResolver(this.expressionContextResolver);
    }

    expressionContextResolver(msg: Message): {} {
        return {
            list: {
                command: validateFunction((listName: string): Promise<string> => {
                    const prefix = CommandSystem.getPrefix(msg.getChannel());
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
                        const event = new Event(CommandEvent);
                        event.extra.put(CommandEvent.EXTRA_TRIGGER, command);
                        event.extra.put(CommandEvent.EXTRA_ARGUMENTS, args);
                        event.extra.put(CommandEvent.EXTRA_MESSAGE, msg.extend(raw, resolve));
                        event.extra.put(CommandEvent.EXTRA_COMMAND, this.listCommand);
                        this.listCommand.execute(event);
                    });
                }, ["string|required"], returnErrorAsync())
            }
        };
    }
}