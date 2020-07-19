import AbstractModule, {Symbols} from "./AbstractModule";
import Command from "../Systems/Commands/Command";
import {CommandEvent} from "../Systems/Commands/CommandEvent";
import ChannelEntity from "../Database/Entities/ChannelEntity";
import ChatterEntity from "../Database/Entities/ChatterEntity";
import CommandSystem from "../Systems/Commands/CommandSystem";
import Permission from "../Systems/Permissions/Permission";
import {Role} from "../Systems/Permissions/Role";
import {appendOrdinal} from "../Utilities/NumberUtils";
import Setting, {Integer, SettingType} from "../Systems/Settings/Setting";
import {ChatterArg} from "../Systems/Commands/Validation/Chatter";
import {getLogger} from "../Utilities/Logger";
import {command} from "../Systems/Commands/decorators";
import {permission} from "../Systems/Permissions/decorators";
import {CommandHandler} from "../Systems/Commands/Validation/CommandHandler";
import CheckPermission from "../Systems/Commands/Validation/CheckPermission";
import {Argument, Channel, ResponseArg, Sender} from "../Systems/Commands/Validation/Argument";
import {Response} from "../Chat/Response";
import {JoinQueueResponse, QueueService} from "../Services/QueueService";

export const MODULE_INFO = {
    name: "Queue",
    version: "1.1.0",
    description: "Users can enter a queue to be selected for some purpose"
};

const logger = getLogger(MODULE_INFO.name);

class QueueCommand extends Command {
    private queueService: QueueService = new QueueService();

    constructor(private queueModule: QueueModule) {
        super("queue", "<join|leave|check|pop|peek|clear|open|close>");
    }

    @CommandHandler("queue join", "queue join")
    @CheckPermission("queue.join")
    async join(
        event: CommandEvent, @ResponseArg response: Response, @Channel channel: ChannelEntity, @Sender sender: ChatterEntity
    ): Promise<void> {
        const result = await this.queueService.joinQueue(sender, channel);
        if (typeof result === "number") {
            return await response.message("queue:joined", { position: appendOrdinal(result) });
        } else {
            switch (result) {
                case JoinQueueResponse.CLOSED: return response.message("queue:error.closed");
                case JoinQueueResponse.FULL: return response.message("queue:error.full");
                case JoinQueueResponse.ALREADY_IN: return response.message("queue:error.in");
            }
        }
    }

    @CommandHandler("queue leave", "queue leave")
    @CheckPermission("queue.leave")
    async leave(
        event: CommandEvent, @ResponseArg response: Response, @Channel channel: ChannelEntity, @Sender sender: ChatterEntity
    ): Promise<void> {
         const result = this.queueService.leaveQueue(sender, channel);
         if (!result.present) return response.message("queue:error.closed");
         return result.value ? await response.message("queue:left") : await response.message("queue:error.not-in");
    }

    @CommandHandler("queue check", "queue check [user]")
    @CheckPermission(event => event.getArgumentCount() < 1 ? "queue.check" : "queue.check.other")
    async check(
        event: CommandEvent, @ResponseArg response: Response, @Channel channel: ChannelEntity, @Sender sender: ChatterEntity,
        @Argument(new ChatterArg(), "user", false) target: ChatterEntity = null
    ): Promise<void> {
        const chatter = target ?? sender;
        const pos = this.queueService.getPosition(chatter, channel);
        return pos < 0 ?
            await response.message("queue:error.not-in"):
            await response.message("queue:check", { username: chatter.name, position: appendOrdinal(pos) });
    }

    @CommandHandler("queue pop", "queue pop")
    @CheckPermission("queue.pop")
    async pop(event: CommandEvent, @ResponseArg response: Response, @Channel channel: ChannelEntity): Promise<void> {
        const chatter = this.queueService.removeNext(channel);
        if (!chatter.present) return response.message("queue:error.empty");
        return response.message("queue:next", { username: chatter.value.name })
    }

    @CommandHandler("queue peek", "queue peek")
    @CheckPermission("queue.peek")
    async peek(event: CommandEvent, @ResponseArg response: Response, @Channel channel: ChannelEntity): Promise<void> {
        const chatter = this.queueService.getNext(channel);
        if (!chatter.present) return response.message("queue:error.empty");
        return response.message("queue:next", { username: chatter.value.name })
    }

    @CommandHandler("queue clear", "queue clear")
    @CheckPermission("queue.clear")
    async clear(event: CommandEvent, @ResponseArg response: Response, @Channel channel: ChannelEntity): Promise<void> {
        this.queueService.clearQueue(channel);
        return response.message("queue:emptied");
    }

    @CommandHandler("queue open", "queue open")
    @CheckPermission("queue.open")
    async open(event: CommandEvent, @ResponseArg response: Response, @Channel channel: ChannelEntity): Promise<void> {
        return this.queueService.openQueue(channel).present ?
            await response.message("queue:opened", { prefix: await CommandSystem.getPrefix(channel) }) :
            await response.message("queue:error.open");
    }

    @CommandHandler("queue close", "queue close")
    @CheckPermission("queue.close")
    async close(event: CommandEvent, @ResponseArg response: Response, @Channel channel: ChannelEntity): Promise<void> {
        return this.queueService.closeQueue(channel).present ?
            await response.message("queue:closed") :
            await response.message("queue:error.closed");
    }
}

export default class QueueModule extends AbstractModule {
    static [Symbols.ModuleInfo] = MODULE_INFO;

    constructor() {
        super(QueueModule);
    }

    @command queueCommand = new QueueCommand(this);

    @permission joinQueue = new Permission("queue.join", Role.NORMAL);
    @permission checkPos = new Permission("queue.check", Role.NORMAL);
    @permission checkPosOther = new Permission("queue.check.other", Role.MODERATOR);
    @permission popQueue = new Permission("queue.pop", Role.MODERATOR);
    @permission peekQueue = new Permission("queue.peek", Role.MODERATOR);
    @permission clearQueue = new Permission("queue.clear", Role.MODERATOR);
    @permission openQueue = new Permission("queue.open", Role.MODERATOR);
    @permission closeQueue = new Permission("queue.close", Role.MODERATOR);

    @permission maxSize = new Setting("queue.max-size", 30 as Integer, SettingType.INTEGER);
}