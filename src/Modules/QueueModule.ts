import AbstractModule, {Symbols} from "./AbstractModule";
import Command from "../Systems/Commands/Command";
import CommandSystem from "../Systems/Commands/CommandSystem";
import Permission from "../Systems/Permissions/Permission";
import {Role} from "../Systems/Permissions/Role";
import {appendOrdinal} from "../Utilities/NumberUtils";
import Setting, {Integer, SettingType} from "../Systems/Settings/Setting";
import {ChatterArg} from "../Systems/Commands/Validation/Chatter";
import {CommandHandler} from "../Systems/Commands/Validation/CommandHandler";
import CheckPermission from "../Systems/Commands/Validation/CheckPermission";
import {Argument, ChannelArg, ResponseArg, Sender} from "../Systems/Commands/Validation/Argument";
import {Response} from "../Chat/Response";
import {JoinQueueResponse, QueueService} from "../Services/QueueService";
import { Service } from "typedi";
import { Channel } from "../Database/Entities/Channel";
import { Chatter } from "../Database/Entities/Chatter";
import Event from "../Systems/Event/Event";
import { CommandEvent } from "../Systems/Commands/CommandEvent";

export const MODULE_INFO = {
    name: "Queue",
    version: "1.2.0",
    description: "Users can enter a queue to be selected for some purpose"
};

@Service()
class QueueCommand extends Command {
    constructor(private readonly queueService: QueueService) {
        super("queue", "<join|leave|check|pop|peek|clear|open|close>");
    }

    @CommandHandler("queue join", "queue join", 1)
    @CheckPermission(() => QueueModule.permissions.joinQueue)
    async join(
        event: Event, @ResponseArg response: Response, @ChannelArg channel: Channel, @Sender sender: Chatter
    ): Promise<void> {
        const result = await this.queueService.joinQueue(sender, channel);
        if (typeof result === "number") {
            return await response.message("queue:joined", {position: appendOrdinal(result)});
        } else {
            switch (result) {
                case JoinQueueResponse.CLOSED:
                    return response.message("queue:error.closed");
                case JoinQueueResponse.FULL:
                    return response.message("queue:error.full");
                case JoinQueueResponse.ALREADY_IN:
                    return response.message("queue:error.in");
            }
        }
    }

    @CommandHandler("queue leave", "queue leave", 1)
    @CheckPermission(() => QueueModule.permissions.leaveQueue)
    async leave(
        event: Event, @ResponseArg response: Response, @ChannelArg channel: Channel, @Sender sender: Chatter
    ): Promise<void> {
        const result = this.queueService.leaveQueue(sender, channel);
        if (!result.present) return response.message("queue:error.closed");
        return result.value ? await response.message("queue:left") : await response.message("queue:error.not-in");
    }

    @CommandHandler("queue check", "queue check [user]", 1)
    @CheckPermission(event => event.extra.get(CommandEvent.EXTRA_ARGUMENTS).length < 1 ? QueueModule.permissions.checkPos : QueueModule.permissions.checkPosOther)
    async check(
        event: Event, @ResponseArg response: Response, @ChannelArg channel: Channel, @Sender sender: Chatter,
        @Argument(new ChatterArg(), "user", false) target: Chatter = null
    ): Promise<void> {
        const chatter = target ?? sender;
        const pos = this.queueService.getPosition(chatter, channel);
        return pos < 0 ?
            await response.message("queue:error.not-in") :
            await response.message("queue:check", {username: chatter.user.name, position: appendOrdinal(pos)});
    }

    @CommandHandler("queue pop", "queue pop", 1)
    @CheckPermission(() => QueueModule.permissions.popQueue)
    async pop(event: Event, @ResponseArg response: Response, @ChannelArg channel: Channel): Promise<void> {
        const chatter = this.queueService.removeNext(channel);
        if (!chatter.present) return response.message("queue:error.empty");
        return response.message("queue:next", {username: chatter.value.user.name});
    }

    @CommandHandler("queue peek", "queue peek", 1)
    @CheckPermission(() => QueueModule.permissions.peekQueue)
    async peek(event: Event, @ResponseArg response: Response, @ChannelArg channel: Channel): Promise<void> {
        const chatter = this.queueService.getNext(channel);
        if (!chatter.present) return response.message("queue:error.empty");
        return response.message("queue:next", {username: chatter.value.user.name});
    }

    @CommandHandler("queue clear", "queue clear", 1)
    @CheckPermission(() => QueueModule.permissions.clearQueue)
    async clear(event: Event, @ResponseArg response: Response, @ChannelArg channel: Channel): Promise<void> {
        this.queueService.clearQueue(channel);
        return response.message("queue:emptied");
    }

    @CommandHandler("queue open", "queue open", 1)
    @CheckPermission(() => QueueModule.permissions.openQueue)
    async open(event: Event, @ResponseArg response: Response, @ChannelArg channel: Channel): Promise<void> {
        return this.queueService.openQueue(channel).present ?
            await response.message("queue:opened", {prefix: CommandSystem.getPrefix(channel)}) :
            await response.message("queue:error.open");
    }

    @CommandHandler("queue close", "queue close", 1)
    @CheckPermission(() => QueueModule.permissions.closeQueue)
    async close(event: Event, @ResponseArg response: Response, @ChannelArg channel: Channel): Promise<void> {
        return this.queueService.closeQueue(channel).present ?
            await response.message("queue:closed") :
            await response.message("queue:error.closed");
    }
}

export default class QueueModule extends AbstractModule {
    static [Symbols.ModuleInfo] = MODULE_INFO;
    static permissions = {
        joinQueue: new Permission("queue.join", Role.NORMAL),
        leaveQueue: new Permission("queue.leave", Role.NORMAL),
        checkPos: new Permission("queue.check", Role.NORMAL),
        checkPosOther: new Permission("queue.check.other", Role.MODERATOR),
        popQueue: new Permission("queue.pop", Role.MODERATOR),
        peekQueue: new Permission("queue.peek", Role.MODERATOR),
        clearQueue: new Permission("queue.clear", Role.MODERATOR),
        openQueue: new Permission("queue.open", Role.MODERATOR),
        closeQueue: new Permission("queue.close", Role.MODERATOR)
    }
    static settings = {
        maxSize: new Setting("queue.max-size", 30 as Integer, SettingType.INTEGER)
    }

    constructor(queueCommand: QueueCommand) {
        super(QueueModule);

        this.registerCommand(queueCommand);
        this.registerPermissions(QueueModule.permissions);
        this.registerSettings(QueueModule.settings);
    }
}