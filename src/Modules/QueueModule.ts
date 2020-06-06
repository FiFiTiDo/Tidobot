import AbstractModule, {ModuleInfo, Symbols, Systems} from "./AbstractModule";
import Command from "../Systems/Commands/Command";
import {CommandEventArgs} from "../Systems/Commands/CommandEvent";
import ChannelEntity from "../Database/Entities/ChannelEntity";
import ChatterEntity from "../Database/Entities/ChatterEntity";
import CommandSystem from "../Systems/Commands/CommandSystem";
import Permission from "../Systems/Permissions/Permission";
import {Role} from "../Systems/Permissions/Role";
import EntityStateList from "../Database/EntityStateList";
import {appendOrdinal} from "../Utilities/NumberUtils";
import Setting, {Integer, SettingType} from "../Systems/Settings/Setting";
import {chatter as chatterConverter} from "../Systems/Commands/Validator/Chatter";
import {ValidatorStatus} from "../Systems/Commands/Validator/Strategies/ValidationStrategy";
import StandardValidationStrategy from "../Systems/Commands/Validator/Strategies/StandardValidationStrategy";
import {tuple} from "../Utilities/ArrayUtils";
import {getLogger} from "../Utilities/Logger";
import {command, Subcommand} from "../Systems/Commands/decorators";
import {permission} from "../Systems/Permissions/decorators";

export const MODULE_INFO = {
    name: "Queue",
    version: "1.0.0",
    description: "Users can enter a queue to be selected for some purpose"
};

const logger = getLogger(MODULE_INFO.name);

class Queue {
    private chatters: ChatterEntity[] = [];
    private _open = false;

    public open(): void {
        this._open = true;
    }

    public close(): void {
        this._open = false;
    }

    public isOpen(): boolean {
        return this._open;
    }

    public pop(): ChatterEntity|undefined {
        return this.chatters.shift();
    }

    public push(chatter: ChatterEntity): number {
        this.chatters.push(chatter);
        return this.chatters.length - 1;
    }

    public peek(): ChatterEntity|undefined {
        return this.chatters.length < 1 ? undefined : this.chatters[0];
    }

    public find(chatter: ChatterEntity): number {
        for (let i = 0; i < this.chatters.length; i++)
            if (chatter.is(this.chatters[i]))
                return i;
        return -1;
    }

    public remove(chatter: ChatterEntity): void {
        const i = this.find(chatter);
        if (i < 0) return;
        this.chatters.splice(i, 1);
    }

    public clear(): void {
        this.chatters = [];
    }

    public size(): number {
        return this.chatters.length;
    }
}

class QueueCommand extends Command {
    private queues: EntityStateList<ChannelEntity, Queue> = new EntityStateList(() => new Queue());

    constructor(private queueModule: QueueModule) {
        super("queue", "<join|leave|check|pop|peek|clear|open|close>");
    }

    @Subcommand("join")
    async join({event, message, response}: CommandEventArgs): Promise<void> {
        const {status} = await event.validate(new StandardValidationStrategy({
            usage: "queue join",
            permission: this.queueModule.joinQueue
        }));
         if (status !== ValidatorStatus.OK) return;

        const queue = await this.queues.get(message.getChannel());
        if (!queue.isOpen()) return response.message("queue:error.closed");
        if (queue.find(message.getChatter()) >= 0) return response.message("queue:error.in");
        const maxSize = await message.getChannel().getSetting(this.queueModule.maxSize);
        if (queue.size() >= maxSize) return response.message("queue:error.full");
        const position = appendOrdinal(queue.push(message.getChatter()) + 1);
        await response.message("queue:joined", { position });
    }

    @Subcommand("leave")
    async leave({event, response, message}: CommandEventArgs): Promise<void> {
        const {status} = await event.validate(new StandardValidationStrategy({
            usage: "queue leave",
            permission: this.queueModule.joinQueue
        }));
         if (status !== ValidatorStatus.OK) return;

        const queue = await this.queues.get(message.getChannel());
        if (!queue.isOpen()) return response.message("queue:error.closed");
        if (queue.find(message.getChatter()) < 0) return response.message("queue:error.not-in");
        queue.remove(message.getChatter());
        await response.message("queue:left");
    }

    @Subcommand("check")
    async check({ event, message, response }: CommandEventArgs): Promise<void> {
        const {status, args} = await event.validate(new StandardValidationStrategy({
            usage: "queue check [user]",
            arguments: tuple(
                chatterConverter({ name: "user", required: false })
            ),
            permission: args => args[0] !== null ? this.queueModule.checkPosOther : this.queueModule.checkPos
        }));
         if (status !== ValidatorStatus.OK) return;

        const queue = await this.queues.get(message.getChannel());
        const index = queue.find(args[0] !== null ? args[0] : message.getChatter()) + 1;
        if (index < 1) return response.message("queue:error.not-in");
        const position = appendOrdinal(index);
        await response.message("queue:check", { username: message.getChatter().name, position });
    }

    @Subcommand("pop")
    async pop({event, message, response}: CommandEventArgs): Promise<void> {
        const {status} = await event.validate(new StandardValidationStrategy({
            usage: "queue pop",
            permission: this.queueModule.popQueue
        }));
         if (status !== ValidatorStatus.OK) return;

        const queue = await this.queues.get(message.getChannel());
        const chatter = queue.pop();
        if (chatter === undefined) return response.message("queue:error.empty");
        return response.message("queue:next", { username: chatter.name })
    }

    @Subcommand("peek")
    async peek({event, response, message} : CommandEventArgs): Promise<void> {
        const {status} = await event.validate(new StandardValidationStrategy({
            usage: "queue peek",
            permission: this.queueModule.peekQueue
        }));
         if (status !== ValidatorStatus.OK) return;

        const queue = await this.queues.get(message.getChannel());
        const chatter = queue.peek();
        if (chatter === undefined) return response.message("queue:error.empty");
        return response.message("queue:next", { username: chatter.name })
    }

    @Subcommand("clear")
    async clear({event, response, message}: CommandEventArgs): Promise<void> {
        const {status} = await event.validate(new StandardValidationStrategy({
            usage: "queue clear",
            permission: this.queueModule.clearQueue
        }));
         if (status !== ValidatorStatus.OK) return;

        const queue = await this.queues.get(message.getChannel());
        queue.clear();
        return response.message("queue:emptied");
    }

    @Subcommand("open")
    async open({ event, message, response }: CommandEventArgs): Promise<void> {
        const {status} = await event.validate(new StandardValidationStrategy({
            usage: "queue open",
            permission: this.queueModule.openQueue
        }));
         if (status !== ValidatorStatus.OK) return;

        const queue = await this.queues.get(message.getChannel());
        if (queue.isOpen()) return response.message("queue:error.open");
        queue.open();
        return response.message("queue:opened", { prefix: await CommandSystem.getPrefix(message.getChannel()) })
    }

    @Subcommand("close")
    async close({ event, message, response }: CommandEventArgs): Promise<void> {
        const {status} = await event.validate(new StandardValidationStrategy({
            usage: "queue close",
            permission: this.queueModule.closeQueue
        }));
         if (status !== ValidatorStatus.OK) return;

        const queue = await this.queues.get(message.getChannel());
        if (!queue.isOpen()) return response.message("queue:error.closed");
        queue.close();
        return response.message("queue:closed");
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