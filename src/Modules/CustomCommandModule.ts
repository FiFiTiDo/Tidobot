import AbstractModule, {Symbols} from "./AbstractModule";
import MessageEvent from "../Chat/Events/MessageEvent";
import {Role} from "../Systems/Permissions/Role";
import Permission from "../Systems/Permissions/Permission";
import {EventHandler, HandlesEvents} from "../Systems/Event/decorators";
import Command from "../Systems/Commands/Command";
import {StringArg} from "../Systems/Commands/Validation/String";
import {getLogger} from "../Utilities/Logger";
import Message from "../Chat/Message";
import {ExpressionContext} from "../Systems/Expressions/ExpressionSystem";
import {CommandHandler} from "../Systems/Commands/Validation/CommandHandler";
import CheckPermission from "../Systems/Commands/Validation/CheckPermission";
import {Argument, ChannelArg, MessageArg, ResponseArg, RestArguments} from "../Systems/Commands/Validation/Argument";
import {Response} from "../Chat/Response";
import {EntityArg} from "../Systems/Commands/Validation/Entity";
import {IntegerArg} from "../Systems/Commands/Validation/Integer";
import {FloatArg} from "../Systems/Commands/Validation/Float";
import {BooleanArg} from "../Systems/Commands/Validation/Boolean";
import {returnErrorAsync, validateFunction} from "../Utilities/ValidateFunction";
import { Service } from "typedi";
import { CommandRepository } from "../Database/Repositories/CommandRepository";
import { Command as CommandEntity, CommandConditionResponse } from "../Database/Entities/Command";
import { InjectRepository } from "typeorm-typedi-extensions";
import { Channel } from "../Database/Entities/Channel";
import Event from "../Systems/Event/Event";
import ConfirmationModule, { ConfirmedEvent } from "./ConfirmationModule";

export const MODULE_INFO = {
    name: "CustomCommand",
    version: "1.4.1",
    description: "Create your own commands with the powerful expression engine."
};

const logger = getLogger(MODULE_INFO.name);
const CommandConverter = new EntityArg(CommandRepository, {msgKey: "command:error.unknown", optionKey: "id"});

@Service()
class CommandCommand extends Command {
    constructor(
        @InjectRepository() 
        private readonly commandRepository: CommandRepository,
        private readonly confirmationModule: ConfirmationModule
    ) {
        super("command", "<add|edit|delete>", ["cmd", "c"]);
    }

    @CommandHandler(/^(c|cmd|command) add/, "command add <trigger> <response>", 1)
    @CheckPermission(() => CustomCommandModule.permissions.editCommand)
    async add(
        event: Event, @ResponseArg response: Response, @ChannelArg channel: Channel,
        @Argument(StringArg) trigger: string,
        @RestArguments(true, {join: " "}) resp: string
    ): Promise<void> {
        this.commandRepository.make(trigger, resp, channel)
            .then(entity => response.message("command:added", {id: entity.commandId}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^(c|cmd|command) edit trigger/, "command edit trigger <id> <new trigger>", 2)
    @CheckPermission(() => CustomCommandModule.permissions.editCommand)
    async editTrigger(
        event: Event, @ResponseArg response: Response, @Argument(CommandConverter) command: CommandEntity,
        @RestArguments(true, {join: " "}) value: string
    ): Promise<void> {
        command.trigger = value;
        command.save()
            .then(() => response.message("command:edit.trigger", {id: command.commandId, value}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^(c|cmd|command) edit (condition|cond)/, "command edit condition <id> <new condition>", 2)
    @CheckPermission(() => CustomCommandModule.permissions.editCommand)
    async editCondition(
        event: Event, @ResponseArg response: Response, @Argument(CommandConverter) command: CommandEntity,
        @RestArguments(true, {join: " "}) value: string
    ): Promise<void> {
        command.condition = value;
        command.save()
            .then(() => response.message("command:edit.condition", {id: command.commandId, value}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^(c|cmd|command) edit (response|resp)/, "command edit response <id> <new response>", 2)
    @CheckPermission(() => CustomCommandModule.permissions.editCommand)
    async editResponse(
        event: Event, @ResponseArg response: Response, @Argument(CommandConverter) command: CommandEntity,
        @RestArguments(true, {join: " "}) value: string
    ): Promise<void> {
        command.response = value;
        command.save()
            .then(() => response.message("command:edit.response", {id: command.commandId, value}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^(c|cmd|command) edit price/, "command edit price <id> <new price>", 2)
    @CheckPermission(() => CustomCommandModule.permissions.editCommand)
    async editPrice(
        event: Event, @ResponseArg response: Response, @Argument(CommandConverter) command: CommandEntity,
        @Argument(new FloatArg({min: 0})) value: number
    ): Promise<void> {
        command.price = value;
        command.save()
            .then(() => response.message("command:edit.price", {id: command.commandId, value}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^(c|cmd|command) edit (global-cooldwn|gc)/, "command edit global-cooldown <id> <new cooldown>", 2)
    @CheckPermission(() => CustomCommandModule.permissions.editCommand)
    async editGlobalCooldown(
        event: Event, @ResponseArg response: Response, @Argument(CommandConverter) command: CommandEntity,
        @Argument(new IntegerArg({min: 0})) value: number
    ): Promise<void> {
        command.globalCooldown = value;
        command.save()
            .then(() => response.message("command:edit.global-cooldown", {id: command.commandId, value}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^(c|cmd|command) edit (user-cooldown|uc)/, "command edit user-cooldown <id> <new cooldown>", 2)
    @CheckPermission(() => CustomCommandModule.permissions.editCommand)
    async editUserCooldown(
        event: Event, @ResponseArg response: Response, @Argument(CommandConverter) command: CommandEntity,
        @Argument(new IntegerArg({min: 0})) value: number
    ): Promise<void> {
        command.userCooldown = value;
        command.save()
            .then(() => response.message("command:edit.user-cooldown", {id: command.commandId, value}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^(c|cmd|command) edit enabled/, "command edit enabled <id> <new value>", 2)
    @CheckPermission(() => CustomCommandModule.permissions.editCommand)
    async editEnabled(
        event: Event, @ResponseArg response: Response, @Argument(CommandConverter) command: CommandEntity,
        @Argument(BooleanArg) value: boolean
    ): Promise<void> {
        command.enabled = value;
        command.save()
            .then(() => response.message("command:edit.user-cooldown", {id: command.commandId, value}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^(c|cmd|command) (delete|del)/, "command delete <id>", 1)
    @CheckPermission(() => CustomCommandModule.permissions.deleteCommand)
    async delete(
        event: Event, @ResponseArg response: Response, @Argument(CommandConverter) command: CommandEntity
    ): Promise<void> {
        const id = command.commandId;
        command.remove()
            .then(() => response.message("command:deleted", {id}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^(c|cmd|command) (reset)$/, "command reset", 1)
    @CheckPermission(() => CustomCommandModule.permissions.resetCommands)
    async reset(event: Event, @MessageArg message: Message, @ResponseArg response: Response, @ChannelArg channel: Channel): Promise<void> {
        const confirmation = await this.confirmationModule.make(message, await response.translate("command:reset.confirm"), 10);
        confirmation.addListener(ConfirmedEvent, async () => {
            try {
                const count = channel.commands.length;
                await this.commandRepository.remove(channel.commands);
                channel.commandIdCounter = 1;
                await channel.save();
                return response.message("command:reset.successful", {count});
            } catch (e) {
                return response.genericErrorAndLog(e, logger, "Failed to reset commands");
            }
        });
    }
}

@Service()
@HandlesEvents()
export default class CustomCommandModule extends AbstractModule {
    static [Symbols.ModuleInfo] = MODULE_INFO;
    static permissions = {
        addCommand: new Permission("command.add", Role.MODERATOR),
        editCommand: new Permission("command.edit", Role.MODERATOR),
        deleteCommand: new Permission("command.delete", Role.MODERATOR),
        resetCommands: new Permission("command.reset", Role.MODERATOR),
        freeUsage: new Permission("command.free", Role.MODERATOR),
        ignoreCooldown: new Permission("command.ignore-cooldown", Role.MODERATOR),
    }

    constructor(commandCommand: CommandCommand) {
        super(CustomCommandModule);

        this.registerCommand(commandCommand);
        this.registerExpressionContextResolver(this.expressionContextResolver);
    }

    expressionContextResolver(message: Message): ExpressionContext {
        return {
            alias: validateFunction(async (command: string): Promise<string> => new Promise(resolve => {
                if (message.checkLoopProtection(command)) return message.response.translate("expression:error.infinite-loop");
                const newMsg = message.extend(`${command} ${message.parts.slice(1).join(" ")}`, resolve);
                newMsg.addToLoopProtection(command);
                const event = new Event(MessageEvent);
                event.extra.put(MessageEvent.EXTRA_MESSAGE, newMsg);
                this.handleMessage(event);
            }), ["string|required"], returnErrorAsync())
        };
    }

    @EventHandler(MessageEvent)
    async handleMessage(event: Event): Promise<void> {
        const message = event.extra.get(MessageEvent.EXTRA_MESSAGE);

        if (this.isDisabled(message.channel)) return;
        if (message.parts.length < 1) return;

        const trigger = message.getPart(0);
        const commands = message.channel.commands.filter(command => command.trigger === trigger);
        if (commands.length < 1) return;

        let executed = 0;
        const defCommands = [];
        for (const command of commands) {
            const res = await command.checkCondition(message);
            if (res === CommandConditionResponse.RUN_NOW) {
                if (command.price > 0 && !(await message.chatter.charge(command.price))) continue;
                executed++;
                await message.response.rawMessage(await command.getResponse(message));
            } else if (res === CommandConditionResponse.RUN_DEFAULT) {
                defCommands.push(command);
            }
        }

        if (executed === 0) {
            for (const command of defCommands) {
                if (command.price > 0 && !(await message.chatter.charge(command.price))) continue;
                executed++;
                await message.response.rawMessage(await command.getResponse(message));
            }
        }

        message.channel.logger.debug(`Custom command ${trigger} triggered by ${message.chatter.user.name} triggering ${executed} commands.`);
    }
}