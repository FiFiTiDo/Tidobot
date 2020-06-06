import AbstractModule, {ModuleInfo, Symbols, Systems} from "./AbstractModule";
import CountersEntity from "../Database/Entities/CountersEntity";
import Permission from "../Systems/Permissions/Permission";
import {Role} from "../Systems/Permissions/Role";
import {NewChannelEvent, NewChannelEventArgs} from "../Chat/Events/NewChannelEvent";
import {EventHandler, HandlesEvents} from "../Systems/Event/decorators";
import Command from "../Systems/Commands/Command";
import {CommandEventArgs} from "../Systems/Commands/CommandEvent";
import {integer} from "../Systems/Commands/Validator/Integer";
import {string} from "../Systems/Commands/Validator/String";
import StandardValidationStrategy from "../Systems/Commands/Validator/Strategies/StandardValidationStrategy";
import {ValidatorStatus} from "../Systems/Commands/Validator/Strategies/ValidationStrategy";
import {tuple} from "../Utilities/ArrayUtils";
import {entity} from "../Systems/Commands/Validator/Entity";
import {getLogger} from "../Utilities/Logger";
import {ExpressionContextResolver} from "../Systems/Expressions/decorators";
import Message from "../Chat/Message";
import {ExpressionContext} from "../Systems/Expressions/ExpressionSystem";
import {permission} from "../Systems/Permissions/decorators";
import {command, Subcommand} from "../Systems/Commands/decorators";

export const MODULE_INFO = {
    name: "Counter",
    version: "1.0.0",
    description: "Add counters for anything that needs to be counted, add and subtract from them as you wish"
};

const logger = getLogger(MODULE_INFO.name);

class CounterCommand extends Command {
    constructor(private counterModule: CounterModule) {
        super("counter", "<increment|decrement|subtract|add|set|create|delete>");
    }

    async execute(eventArgs: CommandEventArgs): Promise<void> {
        if (await super.executeSubcommands(eventArgs)) return;

        const {event, response} = eventArgs;
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "counter <counter name>",
            arguments: tuple(
                entity({
                    name: "counter",
                    entity: CountersEntity,
                    required: true,
                    error: {msgKey: "counter:unknown", optionKey: "counter"}
                })
            ),
            permission: this.counterModule.checkCounter
        }));
        if (status !== ValidatorStatus.OK) return;
        const [counter] = args;

        await response.message("counter:value", {counter: counter.name, value: counter.value});
    }

    @Subcommand("increment", "inc", "add")
    async increment({event, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "counter increment <counter> [amount]",
            arguments: tuple(
                entity({
                    name: "counter",
                    entity: CountersEntity,
                    required: true,
                    error: {msgKey: "counter:unknown", optionKey: "counter"}
                }),
                integer({name: "amount", required: false, defaultValue: 1})
            ),
            permission: this.counterModule.changeCounter
        }));
        if (status !== ValidatorStatus.OK) return;
        const [counter, amount] = args;

        try {
            counter.value += amount;
            await counter.save();
            await response.message("counter:incremented", {counter: counter.name, amount});
        } catch (e) {
            await response.genericError();
            logger.error("Failed to increment counter");
            logger.error("Caused by: " + e.message);
            logger.error(e.stack);
        }
    }

    @Subcommand("decrement", "dec", "subtract", "sub")
    async decrement({event, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "counter decrement <counter> [amount]",
            arguments: tuple(
                entity({
                    name: "counter",
                    entity: CountersEntity,
                    required: true,
                    error: {msgKey: "counter:unknown", optionKey: "counter"}
                }),
                integer({name: "amount", required: false, defaultValue: 1})
            ),
            permission: this.counterModule.changeCounter
        }));
        if (status !== ValidatorStatus.OK) return;
        const [counter, amount] = args;

        try {
            counter.value -= amount;
            await counter.save();
            await response.message("counter:decremented", {counter: counter.name, amount});
        } catch (e) {
            await response.genericError();
            logger.error("Failed to decrement from counter");
            logger.error("Caused by: " + e.message);
            logger.error(e.stack);
        }
    }

    @Subcommand("set")
    async set({event, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "counter set <counter> <amount>",
            arguments: tuple(
                entity({
                    name: "counter",
                    entity: CountersEntity,
                    required: true,
                    error: {msgKey: "counter:unknown", optionKey: "counter"}
                }),
                integer({name: "amount", required: true})
            ),
            permission: this.counterModule.changeCounter
        }));
        if (status !== ValidatorStatus.OK) return;
        const [counter, amount] = args;

        try {
            counter.value = amount;
            await counter.save();
            await response.message("counter:set", {counter: counter.name, amount});
        } catch (e) {
            await response.genericError();
            logger.error("Failed to set counter");
            logger.error("Caused by: " + e.message);
            logger.error(e.stack);
        }
    }

    @Subcommand("create")
    async create({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "counter create <counter>",
            arguments: tuple(
                string({name: "counter name", required: true})
            ),
            permission: this.counterModule.createCounter
        }));
        if (status !== ValidatorStatus.OK) return;
        const [name] = args;

        try {
            const counter = await CountersEntity.make({channel: msg.getChannel()}, {name, value: 0});
            if (counter === null) {
                await response.message("counter:error.exists", {counter: name});
                return;
            }
            await response.message("counter:created", {counter: counter.name});
        } catch (e) {
            await response.genericError();
            logger.error("Failed to create counter");
            logger.error("Caused by: " + e.message);
            logger.error(e.stack);
        }
    }

    @Subcommand("delete", "del")
    async delete({event, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "counter delete <counter>",
            arguments: tuple(
                entity({
                    name: "counter",
                    entity: CountersEntity,
                    required: true,
                    error: {msgKey: "counter:unknown", optionKey: "counter"}
                })
            ),
            permission: this.counterModule.deleteCounter
        }));
        if (status !== ValidatorStatus.OK) return;
        const [counter] = args;

        try {
            await counter.delete();
            await response.message("counter.deleted", {counter: counter.name});
        } catch (e) {
            await response.genericError();
            logger.error("Failed to delete counter");
            logger.error("Caused by: " + e.message);
            logger.error(e.stack);
        }
    }
}

@HandlesEvents()
export default class CounterModule extends AbstractModule {
    static [Symbols.ModuleInfo] = MODULE_INFO;

    constructor() {
        super(CounterModule);
    }

    @command counterCommand = new CounterCommand(this);

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

                    return {
                        value: counter === null ? couldNotFindCounter : counter.value,
                        add: async (amt: unknown): Promise<string | number> => {
                            if (counter === null) return couldNotFindCounter;
                            if (typeof amt != "number") return "Expected a number for argument 1";

                            counter.value += amt;
                            await counter.save();
                            return counter.value;
                        },
                        sub: async (amt: unknown): Promise<string | number> => {
                            if (counter === null) return couldNotFindCounter;
                            if (typeof amt != "number") return "Expected a number for argument 1";

                            counter.value -= amt;
                            await counter.save();
                            return counter.value;
                        },
                        set: async (amt: unknown): Promise<string | number> => {
                            if (counter === null) return couldNotFindCounter;
                            if (typeof amt != "number") return "Expected a number for argument 1";

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