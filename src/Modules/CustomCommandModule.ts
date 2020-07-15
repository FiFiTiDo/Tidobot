import AbstractModule, {Symbols} from "./AbstractModule";
import MessageEvent from "../Chat/Events/MessageEvent";
import CommandEntity, {CommandConditionResponse} from "../Database/Entities/CommandEntity";
import {Role} from "../Systems/Permissions/Role";
import Permission from "../Systems/Permissions/Permission";
import {EventArguments} from "../Systems/Event/Event";
import {EventHandler, HandlesEvents} from "../Systems/Event/decorators";
import {NewChannelEvent, NewChannelEventArgs} from "../Chat/Events/NewChannelEvent";
import Command from "../Systems/Commands/Command";
import {CommandEvent} from "../Systems/Commands/CommandEvent";
import {string, StringConverter, StringEnumConverter} from "../Systems/Commands/Validation/String";
import {getLogger} from "../Utilities/Logger";
import Message from "../Chat/Message";
import {ExpressionContext} from "../Systems/Expressions/ExpressionSystem";
import {ExpressionContextResolver} from "../Systems/Expressions/decorators";
import {permission} from "../Systems/Permissions/decorators";
import {command} from "../Systems/Commands/decorators";
import {CommandHandler} from "../Systems/Commands/Validation/CommandHandler";
import CheckPermission from "../Systems/Commands/Validation/CheckPermission";
import {Argument, Channel, MessageArg, ResponseArg, RestArguments} from "../Systems/Commands/Validation/Argument";
import {Response} from "../Chat/Response"
import ChannelEntity from "../Database/Entities/ChannelEntity";
import {EntityConverter} from "../Systems/Commands/Validation/Entity";

export const MODULE_INFO = {
    name: "CustomCommand",
    version: "1.3.0",
    description: "Create your own commands with the powerful expression engine."
};

const logger = getLogger(MODULE_INFO.name);
const CommandConverter = new EntityConverter(CommandEntity, { msgKey: "command:error.unknown", optionKey: "id" });

class CommandCommand extends Command {
    constructor() {
        super("command", "<add|edit|delete>", ["cmd", "c"]);
    }

    @CommandHandler("command add", "<trigger> <response>", 1)
    @CheckPermission("command.add")
    async add(
        event: CommandEvent, @ResponseArg response: Response, @Channel channel: ChannelEntity,
        @Argument(StringConverter) trigger: string,
        @RestArguments(true, true) resp: string
    ): Promise<void> {
        CommandEntity.create(trigger, resp, channel)
            .then(entity => response.message("command:added", {id: entity.id}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler("command edit", "<trigger|condition|response|price|cooldown> <id> <new value>", 1)
    @CheckPermission("command.edit")
    async edit(
        event: CommandEvent, @ResponseArg response: ChatResponse, @Channel channel: ChannelEntity, @MessageArg msg: Message,
        @Argument(new StringEnumConverter(["trigger", "condition", "response", "price", "cooldown"]), "attribute") type: string,
        @Argument(CommandConverter) command: CommandEntity,
        @RestArguments(true, true) value: string
    ): Promise<void> {
        switch (type.toLowerCase()) {
            case "trigger": command.trigger = value.toLowerCase(); break;
            case "condition": command.condition = value; break;
            case "response": command.response = value; break;
            case "price": {
                const price = parseFloat(value);
                if (isNaN(price))
                    return response.invalidArgumentKey("command:argument.price", value, "command edit price <id> <new price>");
                command.price = price;
                break;
            }
            case "cooldown": {
                const seconds = parseInt(value);
                if (isNaN(seconds))
                    return response.invalidArgumentKey("command:argument.cooldown", value, "command edit cooldown <id> <seconds>");
                command.userCooldown = seconds;
                break;
            }
            default:
                return response.invalidArgumentKey("command:argument.type", type, "command edit <trigger|condition|response|price> <id> <new value>");
        }

        command.save()
            .then(() => response.message(`command:edit.${type}`, {id: command.id, value}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler("command delete", "<id>", 1)
    @CheckPermission("command.delete")
    async delete(
        event: CommandEvent, @ResponseArg response: ChatResponse, @Channel channel: ChannelEntity,
        @Argument(CommandConverter) command: CommandEntity
    ): Promise<void> {
        command.delete()
            .then(() => response.message("command:deleted", {id: command.id}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }
}

@HandlesEvents()
export default class CustomCommandModule extends AbstractModule {
    static [Symbols.ModuleInfo] = MODULE_INFO;

    constructor() {
        super(CustomCommandModule);
    }

    @command commandCommand = new CommandCommand();

    @permission addCommand = new Permission("command.add", Role.MODERATOR);
    @permission editCommand = new Permission("command.edit", Role.MODERATOR);
    @permission deleteCommand = new Permission("command.delete", Role.MODERATOR);
    @permission freeUsage = new Permission("command.free", Role.MODERATOR);
    @permission ignoreCooldown = new Permission("command.ignore-cooldown", Role.MODERATOR);

    @ExpressionContextResolver
    expressionContextResolver(msg: Message): ExpressionContext {
        return {
            alias: async (command: unknown): Promise<string> => new Promise(resolve => {
                if (typeof command !== "string") return msg.getResponse().translate("expression:error.argument", {
                    expected: msg.getResponse().translate("expression:types.string")
                });
                if (msg.checkLoopProtection(command)) return msg.getResponse().translate("expression:error.infinite-loop");
                const newMsg = msg.extend(`${command} ${msg.getParts().slice(1).join(" ")}`, resolve);
                newMsg.addToLoopProtection(command);
                this.handleMessage({event: new MessageEvent(newMsg)});
            })
        };
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
                if (command.price > 0 && !(await msg.getChatter().charge(command.price))) continue;
                executed++;
                await msg.getResponse().rawMessage(await command.getResponse(msg));
            } else if (res === CommandConditionResponse.RUN_DEFAULT) {
                defCommands.push(command);
            }
        }

        if (executed === 0) {
            for (const command of defCommands) {
                if (command.price > 0 && !(await msg.getChatter().charge(command.price))) continue;
                executed++;
                await msg.getResponse().rawMessage(await command.getResponse(msg));
            }
        }

        msg.getChannel().logger.debug(`Custom command ${trigger} triggered by ${msg.getChatter().name} triggering ${executed} commands.`);
    }
}