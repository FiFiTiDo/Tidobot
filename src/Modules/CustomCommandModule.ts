import AbstractModule, {ModuleInfo} from "./AbstractModule";
import MessageEvent from "../Chat/Events/MessageEvent";
import CommandEntity, {CommandConditionResponse} from "../Database/Entities/CommandEntity";
import {Role} from "../Systems/Permissions/Role";
import Permission from "../Systems/Permissions/Permission";
import {EventArguments} from "../Systems/Event/Event";
import {EventHandler, HandlesEvents} from "../Systems/Event/decorators";
import {NewChannelEvent, NewChannelEventArgs} from "../Chat/Events/NewChannelEvent";
import Command from "../Systems/Commands/Command";
import {CommandEventArgs} from "../Systems/Commands/CommandEvent";
import CommandSystem from "../Systems/Commands/CommandSystem";
import {string} from "../Systems/Commands/Validator/String";
import {integer} from "../Systems/Commands/Validator/Integer";
import StandardValidationStrategy from "../Systems/Commands/Validator/Strategies/StandardValidationStrategy";
import {ValidatorStatus} from "../Systems/Commands/Validator/Strategies/ValidationStrategy";
import {tuple} from "../Utilities/ArrayUtils";
import getLogger from "../Utilities/Logger";

export const MODULE_INFO = {
    name: "CustomCommand",
    version: "1.0.0",
    description: "Create your own commands with the powerful expression engine."
};

const logger = getLogger(MODULE_INFO.name);

class CommandCommand extends Command {
    constructor() {
        super("command", "<add|edit|delete>", ["cmd", "c"]);

        this.addSubcommand("add", this.add);
        this.addSubcommand("edit", this.edit);
        this.addSubcommand("delete", this.delete);
    }

    async add({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "command add <trigger> <response>",
            arguments: tuple(
                string({ name: "trigger", required: true }),
                string({ name: "response", required: true, greedy: true })
            ),
            permission: "command.add"
        }));
         if (status !== ValidatorStatus.OK) return;
        const trigger = args[0].toLowerCase();
        const resp = args[1];

        try {
            const command = await CommandEntity.create(trigger, resp, msg.getChannel());
            await response.message("command:added", {id: command.id});
        } catch (e) {
            await response.genericError();
            logger.error("Unable to add custom command");
            logger.error("Caused by: " + e.message);
            logger.error(e.stack);
        }
    }

    async edit({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "command edit <trigger|condition|response|price|cooldown> <id> <new value>",
            arguments: tuple(
                string({ name: "attribute", required: true, accepted: ["trigger", "condition", "response", "price", "cooldown"] }),
                integer({ name: "id", required: true, min: 0 }),
                string({ name: "new value", required: true, greedy: true})
            ),
            permission: "command.edit"
        }));
         if (status !== ValidatorStatus.OK) return;
        const [type, id, value] = args;
        const command: CommandEntity = await CommandEntity.get(id, {channel: msg.getChannel()});
        if (command === null) {
            await response.message("command:error.unknown", {id});
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
                    await CommandSystem.showInvalidArgument(await response.translate("command:argument.price"), value, "command edit price <id> <new price>", msg);
                    return;
                }

                command.price = price;
                break;
            }
            case "cooldown": {
                const seconds = parseInt(value);

                if (isNaN(seconds)) {
                    await CommandSystem.showInvalidArgument(await response.translate("command:argument.cooldown"), value, "command edit cooldown <id> <seconds>", msg);
                    return;
                }

                command.cooldown = seconds;
                break;
            }
            default:
                await CommandSystem.showInvalidArgument(await response.translate("command:argument.type"), type, "command edit <trigger|condition|response|price> <id> <new value>", msg);
                return;
        }

        command.save()
            .then(() => response.message(`command:edit.${type}`, {id, value}))
            .catch(async (e) => {
                await response.genericError();
                logger.error("Failed to save changes to custom command");
            logger.error("Caused by: " + e.message);
            logger.error(e.stack);
            });
    }

    async delete({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "command delete <id>",
            arguments: tuple(integer({ name: "id", required: true, min: 0 }))
        }));
         if (status !== ValidatorStatus.OK) return;

        const id = args[0];
        const command = await CommandEntity.get(id, {channel: msg.getChannel()});
        if (command === null) return response.message("command:error.unknown", {id});

        command.delete()
            .then(() => response.message("command:deleted", {id}))
            .catch(async (e) => {
                await response.genericError();
                logger.error("Failed to delete the custom command");
            logger.error("Caused by: " + e.message);
            logger.error(e.stack);
            });
    }
}

@HandlesEvents()
export default class CustomCommandModule extends AbstractModule {
    constructor() {
        super(CustomCommandModule.name);
    }

    initialize({ command, permission, expression }): ModuleInfo {
        command.registerCommand(new CommandCommand(), this);
        permission.registerPermission(new Permission("command.add", Role.MODERATOR));
        permission.registerPermission(new Permission("command.edit", Role.MODERATOR));
        permission.registerPermission(new Permission("command.delete", Role.MODERATOR));
        permission.registerPermission(new Permission("command.free", Role.MODERATOR));
        permission.registerPermission(new Permission("command.ignore-cooldown", Role.MODERATOR));
        expression.registerResolver(msg => ({
            alias: async (command: unknown): Promise<string> => new Promise(resolve => {
                if (typeof command !== "string") return msg.getResponse().translate("expression:error.argument", {
                    expected: msg.getResponse().translate("expression:types.string")
                });
                if (msg.checkLoopProtection(command)) return msg.getResponse().translate("expression:error.infinite-loop");
                const newMsg = msg.extend(`${command} ${msg.getParts().slice(1).join(" ")}`, resolve);
                newMsg.addToLoopProtection(command);
                this.handleMessage({event: new MessageEvent(newMsg)});
            })
        }));

        return MODULE_INFO;
    }

    @EventHandler(NewChannelEvent)
    async onNewChannel({channel}: NewChannelEventArgs): Promise<void> {
        await CommandEntity.createTable({channel});
    }

    @EventHandler(MessageEvent)
    async handleMessage({event}: EventArguments<MessageEvent>): Promise<void> {
        const msg = event.getMessage();

        if (this.isDisabled(msg.getChannel())) return;
        if (msg.getParts().length < 1) return;

        const trigger = msg.getPart(0);
        const commands = await CommandEntity.findByTrigger(trigger, msg.getChannel());
        if (commands.length < 1) return;

        let executed = 0;
        const defCommands = [];
        for (const command of commands) {
            const res = await command.checkCondition(msg);
            if (res === CommandConditionResponse.RUN_NOW) {
                executed++;
                await msg.getResponse().rawMessage(await command.getResponse(msg));
            } else if (res === CommandConditionResponse.RUN_DEFAULT) {
                defCommands.push(command);
            }
        }

        if (executed === 0) {
            for (const command of defCommands) {
                executed++;
                await msg.getResponse().rawMessage(await command.getResponse(msg));
            }
        }

        msg.getChannel().logger.debug(`Custom command ${trigger} triggered by ${msg.getChatter().name} triggering ${executed} commands.`);
    }
}