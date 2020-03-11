import AbstractModule from "./AbstractModule";
import CommandModule, {CommandEvent, SubcommandHelper} from "./CommandModule";
import PermissionModule, {PermissionLevel} from "./PermissionModule";
import MessageEvent from "../Chat/Events/MessageEvent";
import Application from "../Application/Application";
import {__} from "../Utilities/functions";
import Dispatcher from "../Event/Dispatcher";
import ChannelSchemaBuilder from "../Database/ChannelSchemaBuilder";
import ExpressionModule from "./ExpressionModule";
import CommandEntity, {CommandConditionResponse} from "../Database/Entities/CommandEntity";

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
        let commands = await CommandEntity.findByTrigger(trigger, this.getServiceName(), msg.getChannel().getName());
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

        let [trigger, response] = args;
        trigger = trigger.toLowerCase();

        try {
            let command = await CommandEntity.create(trigger, response, this.getServiceName(), msg.getChannel().getName());
            await msg.reply(__("commands.add.successful", command.id));
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
        let [type, id, value] = args;
        let command: CommandEntity = await CommandEntity.get(id, this.getServiceName(), msg.getChannel().getName());
        if (command === null) {
            await msg.reply(__("commands.unknown", id));
            return;
        }

        switch (type.toLowerCase()) {
            case "trigger":
                command.trigger = value.toLowerCase();
                break;
            case "condition":
                command.condition = value;
                break;
            case "response":
                command.response = value;
                break;
            case "price":
                let price = parseFloat(value);

                if (isNaN(price)) {
                    await this.getModuleManager().getModule(CommandModule)
                        .showInvalidArgument("new price", value, "command edit price <id> <new price>", msg);
                    return;
                }

                command.price = price;
                break;
            case "cooldown":
                let seconds = parseInt(value);

                if (isNaN(seconds)) {
                    await this.getModuleManager().getModule(CommandModule)
                        .showInvalidArgument("seconds", value, "command edit cooldown <id> <seconds>", msg);
                    return;
                }

                command.cooldown = seconds;
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
                    type: "integer",
                    required: true
                }
            ]
        });
        if (args === null) return;

        let [id] = args;
        let command = await CommandEntity.get(id, this.getServiceName(), msg.getChannel().getName());
        if (command === null) {
            await msg.reply(__("commands.unknown", id));
            return;
        }

        command.delete()
            .then(() => msg.reply(__("commands.delete.successful", id)))
            .catch(e => {
                msg.reply(__("commands.delete.failed"));
                Application.getLogger().error("Failed to delete the custom command", {cause: e});
            });
    };
}