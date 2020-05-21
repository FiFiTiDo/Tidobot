import AbstractModule from "./AbstractModule";
import CountersEntity from "../Database/Entities/CountersEntity";
import PermissionSystem from "../Systems/Permissions/PermissionSystem";
import Permission from "../Systems/Permissions/Permission";
import {Role} from "../Systems/Permissions/Role";
import Logger from "../Utilities/Logger";
import {NewChannelEvent, NewChannelEventArgs} from "../Chat/Events/NewChannelEvent";
import ExpressionSystem from "../Systems/Expressions/ExpressionSystem";
import {EventHandler, HandlesEvents} from "../Systems/Event/decorators";
import Command from "../Systems/Commands/Command";
import {CommandEventArgs} from "../Systems/Commands/CommandEvent";
import CommandSystem from "../Systems/Commands/CommandSystem";
import {onePartConverter} from "../Systems/Commands/Validator/Converter";
import {InvalidInputError} from "../Systems/Commands/Validator/ValidationErrors";
import {integer} from "../Systems/Commands/Validator/Integer";
import {string} from "../Systems/Commands/Validator/String";
import StandardValidationStrategy from "../Systems/Commands/Validator/Strategies/StandardValidationStrategy";
import {ValidatorStatus} from "../Systems/Commands/Validator/Strategies/ValidationStrategy";
import {tuple} from "../Utilities/ArrayUtils";

const counterConverter = onePartConverter("counter name", "counter", true, null, async (part, column, msg) => {
    const list = await CountersEntity.findByName(part, msg.getChannel());
    if (list === null)
        throw new InvalidInputError(await msg.getResponse().translate("counter:unknown", {counter: part}));
    return list;
});

class CounterCommand extends Command {
    constructor() {
        super("counter", "<increment|decrement|subtract|add|set|create|delete>");

        this.addSubcommand("increment", this.increment);
        this.addSubcommand("inc", this.increment);
        this.addSubcommand("add", this.increment);
        this.addSubcommand("decrement", this.decrement);
        this.addSubcommand("dec", this.decrement);
        this.addSubcommand("subtract", this.decrement);
        this.addSubcommand("sub", this.decrement);
        this.addSubcommand("set", this.set);
        this.addSubcommand("create", this.create);
        this.addSubcommand("delete", this.delete);
        this.addSubcommand("del", this.delete);
    }

    async execute(eventArgs: CommandEventArgs): Promise<void> {
        if (await super.executeSubcommands(eventArgs)) return;

        const {event, response} = eventArgs;
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "list <list name> [item number]",
            arguments: tuple(
                counterConverter
            ),
            permission: "counter.check"
        }));
        if (status !== ValidatorStatus.OK) return;
        const [counter] = args;

        await response.message("counter:value", {counter: counter.name, value: counter.value});
    }

    async increment({event, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "counter increment <counter> [amount]",
            arguments: tuple(
                counterConverter,
                integer({ name: "amount", required: false, defaultValue: 1 })
            ),
            permission: "counter.change"
        }));
        if (status !== ValidatorStatus.OK) return;
        const [counter, amount] = args;

        try {
            counter.value += amount;
            await counter.save();
            await response.message("counter:incremented", {counter: counter.name, amount});
        } catch (e) {
            await response.genericError();
            Logger.get().error("Failed to increment counter", {cause: e});
        }
    }

    async decrement({event, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "counter decrement <counter> [amount]",
            arguments: tuple(
                counterConverter,
                integer({ name: "amount", required: false, defaultValue: 1 })
            ),
            permission: "counter.change"
        }));
        if (status !== ValidatorStatus.OK) return;
        const [counter, amount] = args;

        try {
            counter.value -= amount;
            await counter.save();
            await response.message("counter:decremented", {counter: counter.name, amount});
        } catch (e) {
            await response.genericError();
            Logger.get().error("Failed to decrement from counter", {cause: e});
        }
    }

    async set({event, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "counter set <counter> <amount>",
            arguments: tuple(
                counterConverter,
                integer({ name: "amount", required: true })
            ),
            permission: "counter.change"
        }));
        if (status !== ValidatorStatus.OK) return;
        const [counter, amount] = args;

        try {
            counter.value = amount;
            await counter.save();
            await response.message("counter:set", {counter: counter.name, amount});
        } catch (e) {
            await response.genericError();
            Logger.get().error("Failed to set counter", {cause: e});
        }
    }

    async create({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "counter create <counter>",
            arguments: tuple(
                string({ name: "counter name", required: true })
            ),
            permission: "counter.create"
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
            Logger.get().error("Failed to create counter", {cause: e});
        }
    }

    async delete({event, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "counter delete <counter>",
            arguments: tuple(
                counterConverter
            ),
            permission: "counter.create"
        }));
        if (status !== ValidatorStatus.OK) return;
        const [counter] = args;

        try {
            await counter.delete();
            await response.message("counter.deleted", {counter: counter.name});
        } catch (e) {
            await response.genericError();
            Logger.get().error("Failed to delete counter", {cause: e});
        }
    }
}

@HandlesEvents()
export default class CounterModule extends AbstractModule {
    constructor() {
        super(CounterModule.name);
    }

    initialize(): void {
        const cmd = CommandSystem.getInstance();
        cmd.registerCommand(new CounterCommand(), this);

        const perm = PermissionSystem.getInstance();
        perm.registerPermission(new Permission("counter.check", Role.NORMAL));
        perm.registerPermission(new Permission("counter.change", Role.MODERATOR));
        perm.registerPermission(new Permission("counter.create", Role.MODERATOR));
        perm.registerPermission(new Permission("counter.delete", Role.MODERATOR));

        ExpressionSystem.getInstance().registerResolver(msg => ({
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
        }));
    }

    @EventHandler(NewChannelEvent)
    async onNewChannel({channel}: NewChannelEventArgs) {
        await CountersEntity.createTable({channel});
    }
}