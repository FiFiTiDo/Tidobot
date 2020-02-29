import AbstractModule from "./AbstractModule";
import CommandModule, {CommandEvent, SubcommandHelper} from "./CommandModule";
import PermissionModule, {PermissionLevel} from "./PermissionModule";
import MessageEvent from "../Chat/Events/MessageEvent";
import Application from "../Application/Application";
import Channel from "../Chat/Channel";
import MessageParser from "../Chat/MessageParser";
import {__} from "../Utilities/functions";
import Dispatcher from "../Event/Dispatcher";
import ChannelSchemaBuilder from "../Database/ChannelSchemaBuilder";
import Message from "../Chat/Message";
import ExpressionModule, {ExpressionContext} from "./ExpressionModule";

export default class CustomCommandModule extends AbstractModule {
    constructor() {
        super(CustomCommandModule.name);
    }

    registerListeners(dispatcher: Dispatcher) {
        dispatcher.addListener(MessageEvent, this.messageHandler);
    }

    unregisterListeners(dispatcher: Dispatcher) {
        dispatcher.removeListener(MessageEvent, this.messageHandler);
    }

    messageHandler = async (event: MessageEvent) => {
        let msg = event.getMessage();

        if (this.isDisabled(msg.getChannel())) return;
        if (msg.getParts().length < 1) return;

        let trigger = msg.getPart(0);
        let commands = await Command.findByTrigger(trigger, msg.getChannel());
        if (commands.length < 1) return;

        let defCommands = [];
        let doDefault = true;
        for (let command of commands) {
            let res = await command.checkCondition(msg);
            if (res === CommandConditionResponse.RUN_NOW) {
                await msg.reply(await command.getResponse(msg));
                doDefault = false;
            } else if (res === CommandConditionResponse.RUN_DEFAULT) {
                defCommands.push(command);
            }
        }

        if (doDefault) {
            for (let command of defCommands) {
                let res = await command.checkCondition(msg, true);
                if (res === CommandConditionResponse.RUN_NOW) {
                    await msg.reply(await command.getResponse(msg));
                }
            }
        }
    };

    initialize() {
        let cmd = this.getModuleManager().getModule(CommandModule);
        cmd.registerCommand("command", this.commandCmd, this);
        cmd.registerCommand("cmd", this.commandCmd, this);
        cmd.registerCommand("c", this.commandCmd, this);

        let perm = this.getModuleManager().getModule(PermissionModule);
        perm.registerPermission("command.add", PermissionLevel.MODERATOR);
        perm.registerPermission("command.edit", PermissionLevel.MODERATOR);
        perm.registerPermission("command.delete", PermissionLevel.MODERATOR);
        perm.registerPermission("command.free", PermissionLevel.MODERATOR);
        perm.registerPermission("command.ignore-cooldown", PermissionLevel.MODERATOR);

        this.getModuleManager().getModule(ExpressionModule).registerResolver(msg => {
            return {
                execute_cmd: async (command: unknown) => new Promise(async (resolve, reject) => {
                    if (typeof command !== "string") return "Invalid argument, expected a string";
                    let prefix = await this.getModuleManager().getModule(CommandModule).getPrefix(msg.getChannel());
                    let cmd = prefix + command;
                    if (msg.checkLoopProtection(cmd)) return "Infinite loop detected";
                    let newMsg = msg.extend(cmd + " " + msg.getParts().slice(1).join(" "), resolve);
                    newMsg.addToLoopProtection(cmd);
                    this.messageHandler(new MessageEvent(newMsg));
                })
            }
        });
    }

    createDatabaseTables(builder: ChannelSchemaBuilder) {
        builder.addTable("commands", (table) => {
            table.string('trigger');
            table.string('response');
            table.string('condition');
            table.float('price');
            table.integer('cooldown');
            table.timestamps();
        });
    }

    async commandCmd(event: CommandEvent) {
        let valid = new SubcommandHelper.Builder()
            .addSubcommand("add", this.add)
            .addSubcommand("edit", this.edit)
            .addSubcommand("delete", this.delete)
            .addSubcommand("del", this.delete)
            .build(this)
            .handle(event);
        if (!valid) {
            await this.getModuleManager().getModule(CommandModule).showInvalidSyntax("command <add|edit|delete> [arguments]", event.getMessage());
        }
    }

    async add(event: CommandEvent) {
        let msg = event.getMessage();

        let args = await event.validate({
            usage: "command add <trigger> <response>",
            arguments: [
                {
                    type: "string",
                    required: true
                },
                {
                    type: "string",
                    required: true,
                },
                {
                    type: "string",
                    required: true,
                    greedy: true
                }
            ],
            permission: "command.add"
        });
        if (args === null) return;

        let [, trigger, response] = args;
        trigger = trigger.toLowerCase();

        try {
            let command = await Command.make(trigger, response, msg.getChannel());
            await msg.reply(__("commands.add.successful", command.getId()));
        } catch (e) {
            Application.getLogger().error("Unable to add custom command", {cause: e});
            await msg.reply(__("commands.add.failed"));
        }
    };

    async edit(event: CommandEvent) {
        let msg = event.getMessage();
        let args = await event.validate({
            usage: "command edit <trigger|condition|response|price|cooldown> <id> <new value>",
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
                },
                {
                    type: "string",
                    required: true,
                    greedy: true
                }
            ],
            permission: "command.edit"
        });
        if (args === null) return;
        let [, type, id, value] = args;
        let command = await Command.retrieve(id, msg.getChannel());
        if (command === null) {
            await msg.reply(__("commands.unknown", id));
            return;
        }

        switch (type.toLowerCase()) {
            case "trigger":
                command.setTrigger(value.toLowerCase());
                break;
            case "condition":
                command.setCondition(value);
                break;
            case "response":
                command.setResponse(value);
                break;
            case "price":
                let price = parseFloat(value);

                if (isNaN(price)) {
                    await this.getModuleManager().getModule(CommandModule)
                        .showInvalidArgument("new price", value, "command edit price <id> <new price>", msg);
                    return;
                }

                command.setPrice(price);
                break;
            case "cooldown":
                let seconds = parseInt(value);

                if (isNaN(seconds)) {
                    await this.getModuleManager().getModule(CommandModule)
                        .showInvalidArgument("seconds", value, "command edit cooldown <id> <seconds>", msg);
                    return;
                }

                command.setCooldown(seconds);
                break;
            default:
                await this.getModuleManager().getModule(CommandModule)
                    .showInvalidArgument("type", type, "command edit <trigger|condition|response|price> <id> <new value>", msg);
                return;
        }

        command.save()
            .then(() => {
                if (type === "response" || type === "condition")
                    msg.reply(__("commands.edit." + type + ".successful", id));
                else
                    msg.reply(__("commands.edit." + type + ".successful", id, value));
            })
            .catch(e => {
                msg.reply(__("commands.edit." + type + ".failed"));
                Application.getLogger().error("Failed to save changes to custom command", {cause: e});
            });
    };

    async delete(event: CommandEvent) {
        let msg = event.getMessage();
        let args = await event.validate({
            usage: "command delete <id>",
            arguments: [
                {
                    type: "string",
                    required: true
                },
                {
                    type: "integer",
                    required: true
                }
            ]
        });
        if (args === null) return;

        let [, id] = args;
        let command = await Command.retrieve(id, msg.getChannel());
        if (command === null) {
            await msg.reply(__("commands.unknown", id));
            return;
        }

        command.delete()
            .then(() => {
                msg.reply(__("commands.delete.successful", id));
            })
            .catch(e => {
                msg.reply(__("commands.delete.failed"));
                Application.getLogger().error("Failed to delete the custom command", {cause: e});
            });
    };
}

enum CommandConditionResponse {
    DONT_RUN, RUN_NOW, RUN_DEFAULT
}

class Command {
    private readonly id: number;
    private trigger: string;
    private condition: string;
    private response_raw: string;
    private response_parts: string[];
    private price: number;
    private cooldown: number;
    private channel: Channel;

    constructor(id: number, trigger: string, condition: string, response: string, price: number, channel: Channel) {
        this.id = id;
        this.trigger = trigger;
        this.condition = condition;
        this.setResponse(response);
        this.price = price;
        this.channel = channel;
    }

    static async make(trigger: string, response: string, channel: Channel) {
        const defaultCondition = "true";
        const defaultPrice = 0.0;
        let resp = await channel.query("commands")
            .insert({
                trigger,
                response,
                condition: defaultCondition,
                price: defaultPrice
            })
            .exec();
        if (resp.length < 0) throw new Error("No commands inserted into the database.");
        return new Command(resp[0], trigger, defaultCondition, response, defaultPrice, channel);
    }

    static async retrieve(id: number, channel: Channel): Promise<Command | null> {
        try {
            let rows = await channel.query("commands")
                .select()
                .where().eq("id", id).done()
                .all();
            if (rows.length < 1) return null;
            let row = rows[0];

            return new Command(id, row.trigger, row.condition, row.response, row.price, channel);
        } catch (e) {
            Application.getLogger().error("Unable to retrieve custom command #" + id, {cause: e});
            return null;
        }
    }

    static async findByTrigger(trigger: string, channel: Channel): Promise<Command[]> {
        let commands = [];
        try {
            let rows = await channel.query("commands")
                .select()
                .where().eq('trigger', trigger).done()
                .all();

            for (let row of rows) commands.push(new Command(row.id, row.trigger, row.condition, row.response, row.price, channel));
        } catch (e) {
            Application.getLogger().error("Unable to retrieve custom commands", {cause: e});
            return [];
        }
        return commands;
    }

    getId() {
        return this.id;
    }

    getTrigger() {
        return this.trigger;
    }

    setTrigger(trigger: string) {
        this.trigger = trigger;
    }

    check(trigger: string) {
        return this.trigger === trigger;
    }

    getCondition() {
        return this.condition;
    }

    setCondition(condition: string) {
        this.condition = condition;
    }

    async checkCondition(msg: Message, def = false): Promise<CommandConditionResponse> {
        if (this.condition.toLowerCase() === "@@default" && !def) return CommandConditionResponse.RUN_DEFAULT;
        return Application.getModuleManager().getModule(ExpressionModule).evaluate(this.condition, msg) ?
            CommandConditionResponse.RUN_NOW : CommandConditionResponse.DONT_RUN;
    }

    async getResponse(msg: Message) {
        let parts = [];
        for (let part of this.response_parts) {
            if (part.startsWith("${") && part.endsWith("}")) {
                parts.push(await Application.getModuleManager().getModule(ExpressionModule).evaluate(part.substr(2, part.length - 3), msg));
                continue;
            }

            parts.push(part);
        }
        let resp = parts.join(" ");
        if (resp.startsWith("/") || resp.startsWith(".")) resp = ">> " + resp;
        return resp;
    }

    getRawResponse() {
        return this.response_raw;
    }

    setResponse(response: string) {
        this.response_raw = response;
        this.response_parts = MessageParser.parse(response);
    }

    getPrice() {
        return this.price;
    }

    setPrice(price: number) {
        this.price = price;
    }

    getCooldown() {
        return this.cooldown;
    }

    setCooldown(seconds: number) {
        this.cooldown = seconds;
    }

    async save() {
        return this.channel.query("commands")
            .update({
                trigger: this.trigger,
                response: this.response_raw,
                condition: this.condition,
                price: this.price
            })
            .where().eq("id", this.id).done()
            .exec();
    }

    async delete() {
        return this.channel.query("commands")
            .delete()
            .where().eq("id", this.id).done()
            .exec();
    }
}