import AbstractModule from "./AbstractModule";
import CommandModule, {Command, CommandEventArgs} from "./CommandModule";
import ExpressionModule from "./ExpressionModule";
import CountersEntity from "../Database/Entities/CountersEntity";
import {Key} from "../Utilities/Translator";
import PermissionSystem from "../Systems/Permissions/PermissionSystem";
import Permission from "../Systems/Permissions/Permission";
import {Role} from "../Systems/Permissions/Role";
import Logger from "../Utilities/Logger";
import {NewChannelEvent} from "../Chat/NewChannelEvent";

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

    async increment({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "counter increment <counter> [amount]",
            arguments: [
                {
                    value: {
                        type: "string",
                    },
                    required: true
                },
                {
                    value: {
                        type: "integer",
                    },
                    required: false,
                    defaultValue: "1"
                }
            ],
            permission: "counter.change"
        });
        if (args === null) return;

        const [, name, amt] = args;
        const counter = await CountersEntity.findByName(name, msg.getChannel());
        if (counter === null) {
            await response.message(Key("counter.unknown"), event.getArgument(1));
            return;
        }

        try {
            counter.value += amt;
            await counter.save();
            await response.message(Key("counter.increment.successful"), counter.name, amt);
        } catch (e) {
            await response.message(Key("counter.increment.failed"));
            Logger.get().error("Failed to increment counter", {cause: e});
        }
    }

    async decrement({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "counter decrement <counter> [amount]",
            arguments: [
                {
                    value: {
                        type: "string",
                    },
                    required: true
                },
                {
                    value: {
                        type: "integer",
                    },
                    required: false,
                    defaultValue: "1"
                }
            ],
            permission: "counter.change"
        });
        if (args === null) return;

        const [, name, amt] = args;
        const counter = await CountersEntity.findByName(name, msg.getChannel());
        if (counter === null) {
            await response.message(Key("counter.unknown"), event.getArgument(1));
            return;
        }

        try {
            counter.value -= amt;
            await counter.save();
            await response.message(Key("counter.decrement.successful"), counter.name, amt);
        } catch (e) {
            await response.message(Key("counter.decrement.failed"));
            Logger.get().error("Failed to decrement from counter", {cause: e});
        }
    }

    async set({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "counter set <counter> <amount>",
            arguments: [
                {
                    value: {
                        type: "string",
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
            permission: "counter.change"
        });
        if (args === null) return;

        const counter = await CountersEntity.findByName(args[1], msg.getChannel());
        if (counter === null) {
            await response.message(Key("counter.unknown"), event.getArgument(1));
            return;
        }

        const amt = args[2];
        try {
            counter.value = amt;
            await counter.save();
            await response.message(Key("counter.set.successful"), counter.name, amt);
        } catch (e) {
            await response.message(Key("counter.set.failed"));
            Logger.get().error("Failed to set counter", {cause: e});
        }
    }

    async create({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "counter create <counter>",
            arguments: [
                {
                    value: {
                        type: "string",
                    },
                    required: true
                }
            ],
            permission: "counter.create"
        });
        if (args === null) return;
        const [name] = args;

        try {
            const counter = await CountersEntity.make<CountersEntity>({channel: msg.getChannel()}, {name, value: 0});
            if (counter === null) {
                await response.message(Key("counter.create.already_exists"), name);
                return;
            }
            await response.message(Key("counter.create.successful"), counter.name);
        } catch (e) {
            await response.message(Key("counter.create.failed"));
            Logger.get().error("Failed to create counter", {cause: e});
        }
    }

    async delete({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "counter delete <counter>",
            arguments: [
                {
                    value: {
                        type: "string",
                    },
                    required: true
                }
            ],
            permission: "counter.create"
        });
        if (args === null) return;
        const [name] = args;

        const counter = await CountersEntity.findByName(name, msg.getChannel());
        if (counter === null) {
            await response.message(Key("counter.unknown"), event.getArgument(1));
            return;
        }

        try {
            await counter.delete();
            await response.message(Key("counter.delete.successful"), counter.name);
        } catch (e) {
            await response.message(Key("counter.delete.failed"));
            Logger.get().error("Failed to delete counter", {cause: e});
        }
    }
}

export default class CounterModule extends AbstractModule {
    constructor() {
        super(CounterModule.name);
    }

    initialize(): void {
        const cmd = this.moduleManager.getModule(CommandModule);
        cmd.registerCommand(new CounterCommand(), this);

        const perm = PermissionSystem.getInstance();
        perm.registerPermission(new Permission("counter.change", Role.MODERATOR));
        perm.registerPermission(new Permission("counter.create", Role.MODERATOR));
        perm.registerPermission(new Permission("counter.delete", Role.MODERATOR));

        this.moduleManager.getModule(ExpressionModule).registerResolver(msg => ({
            counters: {
                get: async (name: unknown): Promise<object|string> => {
                    if (typeof name !== "string") return "Expected a string for argument 1";
                    const counter = await CountersEntity.findByName(name, msg.getChannel());
                    const couldNotFindCounter = "Could not find counter";

                    return {
                        value: counter === null ? couldNotFindCounter : counter.value,
                        add: async (amt: unknown): Promise<string|number> => {
                            if (counter === null) return couldNotFindCounter;
                            if (typeof amt != "number") return "Expected a number for argument 1";

                            counter.value += amt;
                            await counter.save();
                            return counter.value;
                        },
                        sub: async (amt: unknown): Promise<string|number> => {
                            if (counter === null) return couldNotFindCounter;
                            if (typeof amt != "number") return "Expected a number for argument 1";

                            counter.value -= amt;
                            await counter.save();
                            return counter.value;
                        },
                        set: async (amt: unknown): Promise<string|number> => {
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

    async onNewChannel({ channel}: NewChannelEvent.Arguments) {
        await CountersEntity.createTable({ channel });
    }
}