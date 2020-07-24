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
import {StringArg} from "../Systems/Commands/Validation/String";
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
import {EntityArg} from "../Systems/Commands/Validation/Entity";
import {IntegerArg} from "../Systems/Commands/Validation/Integer";
import {FloatArg} from "../Systems/Commands/Validation/Float";
import {BooleanArg} from "../Systems/Commands/Validation/Boolean";
import {returnErrorAsync, validateFunction} from "../Utilities/ValidateFunction";

export const MODULE_INFO = {
    name: "CustomCommand",
    version: "1.3.2",
    description: "Create your own commands with the powerful expression engine."
};

const logger = getLogger(MODULE_INFO.name);
const CommandConverter = new EntityArg(CommandEntity, {msgKey: "command:error.unknown", optionKey: "id"});

class CommandCommand extends Command {
    constructor() {
        super("command", "<add|edit|delete>", ["cmd", "c"]);
    }

    @CommandHandler(/^(c|cmd|command) add/, "command add <trigger> <response>", 1)
    @CheckPermission("command.add")
    async add(
        event: CommandEvent, @ResponseArg response: Response, @Channel channel: ChannelEntity,
        @Argument(StringArg) trigger: string,
        @RestArguments(true, {join: " "}) resp: string
    ): Promise<void> {
        CommandEntity.create(trigger, resp, channel)
            .then(entity => response.message("command:added", {id: entity.id}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^(c|cmd|command) edit trigger/, "command edit trigger <id> <new trigger>", 2)
    @CheckPermission("command.edit")
    async editTrigger(
        event: CommandEvent, @ResponseArg response: Response, @Channel channel: ChannelEntity, @MessageArg msg: Message,
        @Argument(CommandConverter) command: CommandEntity,
        @RestArguments(true, {join: " "}) value: string
    ): Promise<void> {
        command.trigger = value;
        command.save()
            .then(() => response.message(`command:edit.trigger`, {id: command.id, value}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^(c|cmd|command) edit (condition|cond)/, "command edit condition <id> <new condition>", 2)
    @CheckPermission("command.edit")
    async editCondition(
        event: CommandEvent, @ResponseArg response: Response, @Channel channel: ChannelEntity, @MessageArg msg: Message,
        @Argument(CommandConverter) command: CommandEntity,
        @RestArguments(true, {join: " "}) value: string
    ): Promise<void> {
        command.condition = value;
        command.save()
            .then(() => response.message(`command:edit.condition`, {id: command.id, value}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^(c|cmd|command) edit (response|resp)/, "command edit response <id> <new response>", 2)
    @CheckPermission("command.edit")
    async editResponse(
        event: CommandEvent, @ResponseArg response: Response, @Channel channel: ChannelEntity, @MessageArg msg: Message,
        @Argument(CommandConverter) command: CommandEntity,
        @RestArguments(true, {join: " "}) value: string
    ): Promise<void> {
        command.response = value;
        command.save()
            .then(() => response.message(`command:edit.response`, {id: command.id, value}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^(c|cmd|command) edit price/, "command edit price <id> <new price>", 2)
    @CheckPermission("command.edit")
    async editPrice(
        event: CommandEvent, @ResponseArg response: Response, @Channel channel: ChannelEntity, @MessageArg msg: Message,
        @Argument(CommandConverter) command: CommandEntity,
        @Argument(new FloatArg({min: 0})) value: number
    ): Promise<void> {
        command.price = value;
        command.save()
            .then(() => response.message(`command:edit.price`, {id: command.id, value}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^(c|cmd|command) edit (global-cooldwn|gc)/, "command edit trigger <id> <new cooldown>", 2)
    @CheckPermission("command.edit")
    async editGlobalCooldown(
        event: CommandEvent, @ResponseArg response: Response, @Channel channel: ChannelEntity, @MessageArg msg: Message,
        @Argument(CommandConverter) command: CommandEntity,
        @Argument(new IntegerArg({min: 0})) value: number
    ): Promise<void> {
        command.globalCooldown = value;
        command.save()
            .then(() => response.message(`command:edit.global-cooldown`, {id: command.id, value}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^(c|cmd|command) edit (user-cooldown|uc)/, "command edit user-cooldown <id> <new cooldown>", 2)
    @CheckPermission("command.edit")
    async editUserCooldown(
        event: CommandEvent, @ResponseArg response: Response, @Channel channel: ChannelEntity, @MessageArg msg: Message,
        @Argument(CommandConverter) command: CommandEntity,
        @Argument(new IntegerArg({min: 0})) value: number
    ): Promise<void> {
        command.userCooldown = value;
        command.save()
            .then(() => response.message(`command:edit.user-cooldown`, {id: command.id, value}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^(c|cmd|command) edit enabled/, "command edit enabled <id> <new value>", 2)
    @CheckPermission("command.edit")
    async editEnabled(
        event: CommandEvent, @ResponseArg response: Response, @Channel channel: ChannelEntity, @MessageArg msg: Message,
        @Argument(CommandConverter) command: CommandEntity,
        @Argument(BooleanArg) value: boolean
    ): Promise<void> {
        command.enabled = value;
        command.save()
            .then(() => response.message(`command:edit.user-cooldown`, {id: command.id, value}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^(c|cmd|command) (delete|del)/, "command delete <id>", 1)
    @CheckPermission("command.delete")
    async delete(
        event: CommandEvent, @ResponseArg response: Response, @Channel channel: ChannelEntity,
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
    @command commandCommand = new CommandCommand();
    @permission addCommand = new Permission("command.add", Role.MODERATOR);
    @permission editCommand = new Permission("command.edit", Role.MODERATOR);
    @permission deleteCommand = new Permission("command.delete", Role.MODERATOR);
    @permission freeUsage = new Permission("command.free", Role.MODERATOR);
    @permission ignoreCooldown = new Permission("command.ignore-cooldown", Role.MODERATOR);

    constructor() {
        super(CustomCommandModule);
    }

    @ExpressionContextResolver
    expressionContextResolver(msg: Message): ExpressionContext {
        return {
            alias: validateFunction(async (command: string): Promise<string> => new Promise(resolve => {
                if (msg.checkLoopProtection(command)) return msg.getResponse().translate("expression:error.infinite-loop");
                const newMsg = msg.extend(`${command} ${msg.getParts().slice(1).join(" ")}`, resolve);
                newMsg.addToLoopProtection(command);
                this.handleMessage({event: new MessageEvent(newMsg)});
            }), ["string|required"], returnErrorAsync())
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