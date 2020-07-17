import AbstractModule, {Symbols} from "./AbstractModule";
import CountersEntity from "../Database/Entities/CountersEntity";
import Permission from "../Systems/Permissions/Permission";
import {Role} from "../Systems/Permissions/Role";
import {NewChannelEvent, NewChannelEventArgs} from "../Chat/Events/NewChannelEvent";
import {EventHandler, HandlesEvents} from "../Systems/Event/decorators";
import Command from "../Systems/Commands/Command";
import {CommandEvent} from "../Systems/Commands/CommandEvent";
import {IntegerArg} from "../Systems/Commands/Validation/Integer";
import {StringArg} from "../Systems/Commands/Validation/String";
import {EntityArg} from "../Systems/Commands/Validation/Entity";
import {getLogger} from "../Utilities/Logger";
import {ExpressionContextResolver} from "../Systems/Expressions/decorators";
import Message from "../Chat/Message";
import {ExpressionContext} from "../Systems/Expressions/ExpressionSystem";
import {permission} from "../Systems/Permissions/decorators";
import {command} from "../Systems/Commands/decorators";
import {CommandHandler} from "../Systems/Commands/Validation/CommandHandler";
import {Argument, Channel, ResponseArg} from "../Systems/Commands/Validation/Argument";
import {Response} from "../Chat/Response";
import CheckPermission from "../Systems/Commands/Validation/CheckPermission";
import ChannelEntity from "../Database/Entities/ChannelEntity";

export const MODULE_INFO = {
    name: "Counter",
    version: "1.1.0",
    description: "Add counters for anything that needs to be counted, add and subtract from them as you wish"
};

const logger = getLogger(MODULE_INFO.name);
const CounterConverter = new EntityArg(CountersEntity, {msgKey: "counter:unknown", optionKey: "counter"});

class CounterCommand extends Command {
    constructor() {
        super("counter", "<inc|dec|add|sub|set|create|delete>");
    }

    @CommandHandler(/^counter (?!increment|inc|add|decrement|dec|subtract|sub|set|create|delete|del)/, "counter <counter name>")
    @CheckPermission("counter.check")
    async retrieveValueHandler(
        event: CommandEvent, @ResponseArg response: Response, @Argument(CounterConverter) counter: CountersEntity
    ): Promise<void> {
        return response.message("counter:value", {counter: counter.name, value: counter.value});
    }

    @CommandHandler(/^counter (increment|inc|add)/, "counter increment <counter name> <amount>", 1)
    @CheckPermission("counter.change")
    async increment(
        event: CommandEvent, @ResponseArg response: Response, @Argument(CounterConverter) counter: CountersEntity,
        @Argument(new IntegerArg({ min: 1 }), "amount", false) amount: number = 1
    ): Promise<void> {
        counter.value += amount;
        return counter.save()
            .then(() => response.message("counter:incremented", {counter: counter.name, amount}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^counter (decrement|dec|subtract|sub)/, "counter decrement <counter name> <amount>", 1)
    @CheckPermission("counter.change")
    async decrement(
        event: CommandEvent, @ResponseArg response: Response, @Argument(CounterConverter) counter: CountersEntity,
        @Argument(new IntegerArg({ min: 1 }), "amount", false) amount: number = 1
    ): Promise<void> {
        counter.value -= amount;
        return counter.save()
            .then(() => response.message("counter:decremented", {counter: counter.name, amount}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler("counter set", "counter set <counter name> <amount>", 1)
    @CheckPermission("counter.change")
    async set(
        event: CommandEvent, @ResponseArg response: Response, @Argument(CounterConverter) counter: CountersEntity,
        @Argument(new IntegerArg({ min: 1 })) amount: number
    ): Promise<void> {
        counter.value = amount;
        return counter.save()
            .then(() => response.message("counter:set", {counter: counter.name, amount}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler("counter create", "counter create <counter name>", 1)
    @CheckPermission("counter.create")
    async create(
        event: CommandEvent, @ResponseArg response: Response, @Channel channel: ChannelEntity,
        @Argument(StringArg, "counter name") name: string
    ): Promise<void> {
        return CountersEntity.make({channel}, {name, value: 0})
            .then(entity => response.message(entity === null ? "counter:error.exists" : "counter:created", { counter: name }))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^counter (delete|del)/, "counter delete <counter name>", 1)
    @CheckPermission("counter.delete")
    async delete(
        event: CommandEvent, @ResponseArg response: Response, @Argument(CounterConverter) counter: CountersEntity
    ): Promise<void> {
        return counter.delete()
            .then(() => response.message("counter.deleted", {counter: counter.name}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }
}

@HandlesEvents()
export default class CounterModule extends AbstractModule {
    static [Symbols.ModuleInfo] = MODULE_INFO;

    constructor() {
        super(CounterModule);
    }

    @command counterCommand = new CounterCommand();

    @permission checkCounter = new Permission("counter.check", Role.NORMAL);
    @permission changeCounter = new Permission("counter.change", Role.MODERATOR);
    @permission createCounter = new Permission("counter.create", Role.MODERATOR);
    @permission deleteCounter = new Permission("counter.delete", Role.MODERATOR);

    @EventHandler(NewChannelEvent)
    async onNewChannel({channel}: NewChannelEventArgs) {
        await CountersEntity.createTable({channel});
    }

    @ExpressionContextResolver
    resolveExpressionContext(msg: Message): ExpressionContext {
        return {
            counters: {
                get: async (name: unknown): Promise<object | string> => {
                    if (typeof name !== "string") return "Expected a string for argument 1";
                    const counter = await CountersEntity.findByName(name, msg.getChannel());
                    const couldNotFindCounter = "Could not find counter";
                    const expectedANumber = "Expected a number for argument 1";

                    return {
                        value: counter === null ? couldNotFindCounter : counter.value,
                        add: async (amt: unknown): Promise<string | number> => {
                            if (counter === null) return couldNotFindCounter;
                            if (typeof amt != "number") return expectedANumber;

                            counter.value += amt;
                            await counter.save();
                            return counter.value;
                        },
                        sub: async (amt: unknown): Promise<string | number> => {
                            if (counter === null) return couldNotFindCounter;
                            if (typeof amt != "number") return expectedANumber;

                            counter.value -= amt;
                            await counter.save();
                            return counter.value;
                        },
                        set: async (amt: unknown): Promise<string | number> => {
                            if (counter === null) return couldNotFindCounter;
                            if (typeof amt != "number") return expectedANumber;

                            counter.value = amt;
                            await counter.save();
                            return counter.value;
                        }
                    };
                }
            }
        }
    }
}