import AbstractModule, {Symbols} from "./AbstractModule";
import MessageEvent from "../Chat/Events/MessageEvent";
import {Role} from "../Systems/Permissions/Role";
import Permission from "../Systems/Permissions/Permission";
import {EventArguments} from "../Systems/Event/Event";
import {EventHandler, HandlesEvents} from "../Systems/Event/decorators";
import Command from "../Systems/Commands/Command";
import {CommandEvent} from "../Systems/Commands/CommandEvent";
import {StringArg} from "../Systems/Commands/Validation/String";
import {getLogger} from "../Utilities/Logger";
import Message from "../Chat/Message";
import {ExpressionContext} from "../Systems/Expressions/ExpressionSystem";
import {ExpressionContextResolver} from "../Systems/Expressions/decorators";
import {CommandHandler} from "../Systems/Commands/Validation/CommandHandler";
import CheckPermission from "../Systems/Commands/Validation/CheckPermission";
import {Argument, ChannelArg, ResponseArg, RestArguments} from "../Systems/Commands/Validation/Argument";
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

export const MODULE_INFO = {
    name: "CustomCommand",
    version: "1.4.0",
    description: "Create your own commands with the powerful expression engine."
};

const logger = getLogger(MODULE_INFO.name);
const CommandConverter = new EntityArg(CommandRepository, {msgKey: "command:error.unknown", optionKey: "id"});

@Service()
class CommandCommand extends Command {
    constructor(@InjectRepository() private readonly commandRepository: CommandRepository) {
        super("command", "<add|edit|delete>", ["cmd", "c"]);
    }

    @CommandHandler(/^(c|cmd|command) add/, "command add <trigger> <response>", 1)
    @CheckPermission(() => CustomCommandModule.permissions.editCommand)
    async add(
        event: CommandEvent, @ResponseArg response: Response, @ChannelArg channel: Channel,
        @Argument(StringArg) trigger: string,
        @RestArguments(true, {join: " "}) resp: string
    ): Promise<void> {
        this.commandRepository.make(trigger, resp, channel)
            .then(entity => response.message("command:added", {id: entity.id}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^(c|cmd|command) edit trigger/, "command edit trigger <id> <new trigger>", 2)
    @CheckPermission(() => CustomCommandModule.permissions.editCommand)
    async editTrigger(
        event: CommandEvent, @ResponseArg response: Response, @Argument(CommandConverter) command: CommandEntity,
        @RestArguments(true, {join: " "}) value: string
    ): Promise<void> {
        command.trigger = value;
        command.save()
            .then(() => response.message("command:edit.trigger", {id: command.id, value}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^(c|cmd|command) edit (condition|cond)/, "command edit condition <id> <new condition>", 2)
    @CheckPermission(() => CustomCommandModule.permissions.editCommand)
    async editCondition(
        event: CommandEvent, @ResponseArg response: Response, @Argument(CommandConverter) command: CommandEntity,
        @RestArguments(true, {join: " "}) value: string
    ): Promise<void> {
        command.condition = value;
        command.save()
            .then(() => response.message("command:edit.condition", {id: command.id, value}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^(c|cmd|command) edit (response|resp)/, "command edit response <id> <new response>", 2)
    @CheckPermission(() => CustomCommandModule.permissions.editCommand)
    async editResponse(
        event: CommandEvent, @ResponseArg response: Response, @Argument(CommandConverter) command: CommandEntity,
        @RestArguments(true, {join: " "}) value: string
    ): Promise<void> {
        command.response = value;
        command.save()
            .then(() => response.message("command:edit.response", {id: command.id, value}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^(c|cmd|command) edit price/, "command edit price <id> <new price>", 2)
    @CheckPermission(() => CustomCommandModule.permissions.editCommand)
    async editPrice(
        event: CommandEvent, @ResponseArg response: Response, @Argument(CommandConverter) command: CommandEntity,
        @Argument(new FloatArg({min: 0})) value: number
    ): Promise<void> {
        command.price = value;
        command.save()
            .then(() => response.message("command:edit.price", {id: command.id, value}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^(c|cmd|command) edit (global-cooldwn|gc)/, "command edit global-cooldown <id> <new cooldown>", 2)
    @CheckPermission(() => CustomCommandModule.permissions.editCommand)
    async editGlobalCooldown(
        event: CommandEvent, @ResponseArg response: Response, @Argument(CommandConverter) command: CommandEntity,
        @Argument(new IntegerArg({min: 0})) value: number
    ): Promise<void> {
        command.globalCooldown = value;
        command.save()
            .then(() => response.message("command:edit.global-cooldown", {id: command.id, value}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^(c|cmd|command) edit (user-cooldown|uc)/, "command edit user-cooldown <id> <new cooldown>", 2)
    @CheckPermission(() => CustomCommandModule.permissions.editCommand)
    async editUserCooldown(
        event: CommandEvent, @ResponseArg response: Response, @Argument(CommandConverter) command: CommandEntity,
        @Argument(new IntegerArg({min: 0})) value: number
    ): Promise<void> {
        command.userCooldown = value;
        command.save()
            .then(() => response.message("command:edit.user-cooldown", {id: command.id, value}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^(c|cmd|command) edit enabled/, "command edit enabled <id> <new value>", 2)
    @CheckPermission(() => CustomCommandModule.permissions.editCommand)
    async editEnabled(
        event: CommandEvent, @ResponseArg response: Response, @Argument(CommandConverter) command: CommandEntity,
        @Argument(BooleanArg) value: boolean
    ): Promise<void> {
        command.enabled = value;
        command.save()
            .then(() => response.message("command:edit.user-cooldown", {id: command.id, value}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^(c|cmd|command) (delete|del)/, "command delete <id>", 1)
    @CheckPermission(() => CustomCommandModule.permissions.deleteCommand)
    async delete(
        event: CommandEvent, @ResponseArg response: Response, @Argument(CommandConverter) command: CommandEntity
    ): Promise<void> {
        command.remove()
            .then(() => response.message("command:deleted", {id: command.id}))
            .catch(e => response.genericErrorAndLog(e, logger));
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
        freeUsage: new Permission("command.free", Role.MODERATOR),
        ignoreCooldown: new Permission("command.ignore-cooldown", Role.MODERATOR),
    }

    constructor(commandCommand: CommandCommand) {
        super(CustomCommandModule);

        this.registerCommand(commandCommand);
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

    @EventHandler(MessageEvent)
    async handleMessage({event}: EventArguments<MessageEvent>): Promise<void> {
        const msg = event.getMessage();

        if (this.isDisabled(msg.getChannel())) return;
        if (msg.getParts().length < 1) return;

        const trigger = msg.getPart(0);
        const commands = msg.channel.commands.filter(command => command.trigger === trigger);
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

        msg.channel.logger.debug(`Custom command ${trigger} triggered by ${msg.chatter.user.name} triggering ${executed} commands.`);
    }
}