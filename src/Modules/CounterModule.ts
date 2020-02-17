import AbstractModule from "./AbstractModule";
import CommandModule, {CommandEvent, SubcommandHelper} from "./CommandModule";
import ChannelSchemaBuilder from "../Database/ChannelSchemaBuilder";
import Application from "../Application/Application";
import Channel from "../Chat/Channel";
import PermissionModule, {PermissionLevel} from "./PermissionModule";
import {__} from "../Utilities/functions";
import ExpressionModule from "./ExpressionModule";

export default class CounterModule extends AbstractModule {
    constructor() {
        super(CounterModule.name);
    }

    initialize() {
        const cmd = this.getModuleManager().getModule(CommandModule);
        cmd.registerCommand("counter", this.counterCommand, this);

        const perm = this.getModuleManager().getModule(PermissionModule);
        perm.registerPermission("counter.change", PermissionLevel.MODERATOR);
        perm.registerPermission("counter.create", PermissionLevel.MODERATOR);
        perm.registerPermission("counter.delete", PermissionLevel.MODERATOR);

        this.getModuleManager().getModule(ExpressionModule).registerResolver(msg => {
            return {
                counters: {
                    get: async (name: unknown) => {
                        if (typeof name !== "string") return "Expected a string for argument 1";
                        let counter = await Counter.retrieve(name, msg.getChannel());
                        let could_not_find = "Could not find counter";

                        return {
                            value: counter === null ? could_not_find : counter.getValue(),
                            add: async (amt: unknown) => {
                                if (counter === null) return could_not_find;
                                if (typeof amt != "number") return "Expected a number for argument 1";

                                await counter.add(amt);
                                return counter.getValue();
                            },
                            sub: async (amt: unknown) => {
                                if (counter === null) return could_not_find;
                                if (typeof amt != "number") return "Expected a number for argument 1";

                                await counter.subtract(amt);
                                return counter.getValue();
                            },
                            set: async (amt: unknown) => {
                                if (counter === null) return could_not_find;
                                if (typeof amt != "number") return "Expected a number for argument 1";

                                await counter.setValue(amt);
                                return counter.getValue();
                            }
                        }
                    },
                }
            }
        })
    }

    createDatabaseTables(builder: ChannelSchemaBuilder) {
        builder.addTable("counters", table => {
            table.string("name").unique();
            table.integer("value");
        });
    }

    counterCommand(event: CommandEvent) {
        new SubcommandHelper.Builder()
            .addSubcommand("increment", this.increment)
            .addSubcommand("inc", this.increment)
            .addSubcommand("add", this.increment)
            .addSubcommand("decrement", this.decrement)
            .addSubcommand("dec", this.decrement)
            .addSubcommand("subtract", this.decrement)
            .addSubcommand("sub", this.decrement)
            .addSubcommand("set", this.set)
            .addSubcommand("create", this.create)
            .addSubcommand("delete", this.delete)
            .addSubcommand("del", this.delete)
            .build(this)
            .handle(event);
    }

    async increment(event: CommandEvent) {
        let msg = event.getMessage();
        let args = await event.validate({
            usage: "counter increment <counter> [amount]",
            arguments: [
                {
                    type: "string",
                    required: true
                },
                {
                    type: "string",
                    required: true
                },
                {
                    type: "integer",
                    required: false,
                    defaultValue: "1"
                }
            ],
            permission: "counter.change"
        });
        if (args === null) return;

        let [, name, amt] = args;
        let counter = await Counter.retrieve(name, msg.getChannel());
        if (counter === null) {
            await msg.reply(__("counter.unknown", event.getArgument(1)));
            return;
        }

        try {
            await counter.add(amt);
            await msg.reply(__("counter.increment.successful", counter.getName(), amt));
        } catch (e) {
            await msg.reply(__("counter.increment.failed"));
            Application.getLogger().error("Failed to increment counter", {cause: e});
        }
    };

    async decrement(event: CommandEvent) {
        let msg = event.getMessage();
        let args = await event.validate({
            usage: "counter decrement <counter> [amount]",
            arguments: [
                {
                    type: "string",
                    required: true
                },
                {
                    type: "string",
                    required: true
                },
                {
                    type: "integer",
                    required: false,
                    defaultValue: "1"
                }
            ],
            permission: "counter.change"
        });
        if (args === null) return;

        let [, name, amt] = args;
        let counter = await Counter.retrieve(name, msg.getChannel());
        if (counter === null) {
            await msg.reply(__("counter.unknown", event.getArgument(1)));
            return;
        }

        try {
            await counter.subtract(amt);
            await msg.reply(__("counter.decrement.successful", counter.getName(), amt));
        } catch (e) {
            await msg.reply(__("counter.decrement.failed"));
            Application.getLogger().error("Failed to decrement from counter", {cause: e});
        }
    };

    async set(event: CommandEvent) {
        let msg = event.getMessage();
        let args = await event.validate({
            usage: "counter set <counter> <amount>",
            arguments: [
                {
                    type: "string",
                    required: true
                },
                {
                    type: "string",
                    required: true
                },
                {
                    type: "integer",
                    required: true
                }
            ],
            permission: "counter.change"
        });
        if (args === null) return;

        let counter = await Counter.retrieve(args[1], msg.getChannel());
        if (counter === null) {
            await msg.reply(__("counter.unknown", event.getArgument(1)));
            return;
        }

        let amt = args[2];
        try {
            await counter.setValue(amt);
            await msg.reply(__("counter.set.successful", counter.getName(), amt));
        } catch (e) {
            await msg.reply(__("counter.set.failed"));
            Application.getLogger().error("Failed to set counter", {cause: e});
        }
    };

    async create(event: CommandEvent) {
        let msg = event.getMessage();
        let args = await event.validate({
            usage: "counter create <counter>",
            arguments: [
                {
                    type: "string",
                    required: true
                },
                {
                    type: "string",
                    required: true
                }
            ],
            permission: "counter.create"
        });
        if (args === null) return;

        try {
            let counter = await Counter.make(args[1], msg.getChannel());
            if (counter === null) {
                await msg.reply(__("counter.create.already_exists", event.getArgument(1)));
                return;
            }
            await msg.reply(__("counter.create.successful", counter.getName()));
        } catch (e) {
            await msg.reply(__("counter.create.failed"));
            Application.getLogger().error("Failed to create counter", {cause: e});
        }
    };

    async delete(event: CommandEvent) {
        let msg = event.getMessage();
        let args = await event.validate({
            usage: "counter delete <counter>",
            arguments: [
                {
                    type: "string",
                    required: true
                },
                {
                    type: "string",
                    required: true
                }
            ],
            permission: "counter.create"
        });
        if (args === null) return;

        let counter = await Counter.retrieve(args[1], msg.getChannel());
        if (counter === null) {
            await msg.reply(__("counter.unknown", event.getArgument(1)));
            return;
        }

        try {
            await counter.del();
            await msg.reply(__("counter.delete.successful", counter.getName()));
        } catch (e) {
            await msg.reply(__("counter.delete.failed"));
            Application.getLogger().error("Failed to delete counter", {cause: e});
        }
    };
}

class Counter {
    private readonly name: string;
    private value: number;
    private channel: Channel;

    constructor(name: string, channel: Channel, value = 0) {
        this.name = name;
        this.value = value;
        this.channel = channel;
    }

    static async make(name: string, channel: Channel) {
        let counter = new Counter(name, channel);
        if (await counter.exists()) return null;
        await channel.query("counters").insert({name, value: counter.getValue()}).exec();
        return counter;
    }

    static async retrieve(name: string, channel: Channel) {
        try {
            let rows = await channel.query("commands")
                .select()
                .where().eq("name", name).done()
                .all();
            if (rows.length < 1) return null;
            let row = rows[0];
            return new Counter(name, channel, row.value);
        } catch (e) {
            Application.getLogger().error("Unable to retrieve counter ", name, {cause: e});
            return null;
        }
    }

    async add(amount: number) {
        this.value += amount;
        return this.save();
    }

    async subtract(amount: number) {
        this.value -= amount;
        return this.save();
    }

    async setValue(amount: number) {
        this.value = amount;
        return this.save();
    }

    getValue() {
        return this.value;
    }

    getName() {
        return this.name;
    }

    async exists() {
        return this.channel.query("counters")
            .count()
            .where().eq("name", this.name).done()
            .exec()
            .then(count => count >= 0);
    }

    async save() {
        return this.channel.query("counters").update({value: this.value}).where().eq("name", this.name).done().exec();
    }

    async del() {
        return this.channel.query("counters").delete().where().eq("name", this.name).done().exec();
    }
}