import AbstractModule from "./AbstractModule";
import CommandModule, {Command, CommandEventArgs} from "./CommandModule";
import MessageEvent from "../Chat/Events/MessageEvent";
import ExpressionModule from "./ExpressionModule";
import CommandEntity, {CommandConditionResponse} from "../Database/Entities/CommandEntity";
import {Key} from "../Utilities/Translator";
import PermissionSystem from "../Systems/Permissions/PermissionSystem";
import {Role} from "../Systems/Permissions/Role";
import Permission from "../Systems/Permissions/Permission";
import Logger from "../Utilities/Logger";
import {EventArguments} from "../Systems/Event/Event";
import {EventHandler} from "../Systems/Event/decorators";
import {NewChannelEvent} from "../Chat/NewChannelEvent";


class CommandCommand extends Command {
    constructor() {
        super("command", "<add|edit|delete>", ["cmd", "c"]);

        this.addSubcommand("add", this.add);
        this.addSubcommand("edit", this.edit);
        this.addSubcommand("delete", this.delete);
    }

    async add({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "command add <trigger> <response>",
            arguments: [
                {
                    value: {
                        type: "string",
                    },
                    required: true,
                },
                {
                    value: {
                        type: "string",
                    },
                    required: true,
                    greedy: true
                }
            ],
            permission: "command.add"
        });
        if (args === null) return;
        const trigger = (args[0] as string).toLowerCase();
        const resp = args[1] as string;

        try {
            const command = await CommandEntity.create(trigger, resp, msg.getChannel());
            await response.message(Key("commands.add.successful"), command.id);
        } catch (e) {
            Logger.get().error("Unable to add custom command", {cause: e});
            await response.message(Key("commands.add.failed"));
        }
    }

    async edit({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "command edit <trigger|condition|response|price|cooldown> <id> <new value>",
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
                },
                {
                    value: {
                        type: "string",
                    },
                    required: true,
                    greedy: true
                }
            ],
            permission: "command.edit"
        });
        if (args === null) return;
        const [type, id, value] = args;
        const command: CommandEntity = await CommandEntity.get(id, { channel: msg.getChannel() });
        if (command === null) {
            await response.message(Key("commands.unknown"), id);
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
            case "price": {
                const price = parseFloat(value);

                if (isNaN(price)) {
                    await CommandModule.showInvalidArgument("new price", value, "command edit price <id> <new price>", msg);
                    return;
                }

                command.price = price;
                break;
            }
            case "cooldown": {
                const seconds = parseInt(value);

                if (isNaN(seconds)) {
                    await CommandModule.showInvalidArgument("seconds", value, "command edit cooldown <id> <seconds>", msg);
                    return;
                }

                command.cooldown = seconds;
                break;
            }
            default:
                await CommandModule.showInvalidArgument("type", type, "command edit <trigger|condition|response|price> <id> <new value>", msg);
                return;
        }

        command.save()
            .then(() => {
                if (type === "response" || type === "condition")
                    response.message(Key("commands.edit." + type + ".successful"), id);
                else
                    response.message(Key("commands.edit." + type + ".successful"), id, value);
            })
            .catch(e => {
                response.message(Key("commands.edit." + type + ".failed"));
                Logger.get().error("Failed to save changes to custom command", {cause: e});
            });
    }

    async delete({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "command delete <id>",
            arguments: [
                {
                    value: {
                        type: "integer",
                    },
                    required: true
                }
            ]
        });
        if (args === null) return;

        const [id] = args;
        const command = await CommandEntity.get(id, { channel: msg.getChannel() });
        if (command === null) {
            await response.message(Key("commands.unknown"), id);
            return;
        }

        command.delete()
            .then(() => response.message(Key("commands.delete.successful"), id))
            .catch(e => {
                response.message(Key("commands.delete.failed"));
                Logger.get().error("Failed to delete the custom command", {cause: e});
            });
    }
}

export default class CustomCommandModule extends AbstractModule {
    constructor() {
        super(CustomCommandModule.name);
    }

    @EventHandler(MessageEvent)
    async handleMessage({event}: EventArguments<MessageEvent>): Promise<void> {
        const msg = event.getMessage();

        if (this.isDisabled(msg.getChannel())) return;
        if (msg.getParts().length < 1) return;

        const trigger = msg.getPart(0);
        const commands = await CommandEntity.findByTrigger(trigger, msg.getChannel());
        if (commands.length < 1) return;

        const defCommands = [];
        let doDefault = true;
        for (const command of commands) {
            const res = await command.checkCondition(msg);
            if (res === CommandConditionResponse.RUN_NOW) {
                await msg.reply(await command.getResponse(msg));
                doDefault = false;
            } else if (res === CommandConditionResponse.RUN_DEFAULT) {
                defCommands.push(command);
            }
        }

        if (doDefault) {
            for (const command of defCommands) {
                const res = await command.checkCondition(msg, true);
                if (res === CommandConditionResponse.RUN_NOW)
                    await msg.reply(await command.getResponse(msg));
            }
        }
    }

    initialize(): void {
        const cmd = this.moduleManager.getModule(CommandModule);
        cmd.registerCommand(new CommandCommand(), this);

        const perm = PermissionSystem.getInstance();
        perm.registerPermission(new Permission("command.add", Role.MODERATOR));
        perm.registerPermission(new Permission("command.edit", Role.MODERATOR));
        perm.registerPermission(new Permission("command.delete", Role.MODERATOR));
        perm.registerPermission(new Permission("command.free", Role.MODERATOR));
        perm.registerPermission(new Permission("command.ignore-cooldown", Role.MODERATOR));

        this.moduleManager.getModule(ExpressionModule).registerResolver(msg => ({
            execute_cmd: async (command: unknown): Promise<string> => new Promise( resolve => {
                if (typeof command !== "string") return "Invalid argument, expected a string";
                if (msg.checkLoopProtection(command)) return "Infinite loop detected";
                const newMsg = msg.extend(`${command} ${msg.getParts().slice(1).join(" ")}`, resolve);
                newMsg.addToLoopProtection(command);
                this.handleMessage({ event: new MessageEvent(newMsg) });
            })
        }));
    }

    @EventHandler(NewChannelEvent)
    async onNewChannel({ channel }: NewChannelEvent.Arguments): Promise<void> {
        await CommandEntity.createTable({ channel });
    }
}