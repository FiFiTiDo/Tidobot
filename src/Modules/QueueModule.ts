import AbstractModule from "./AbstractModule";
import Command from "../Systems/Commands/Command";
import {CommandEventArgs} from "../Systems/Commands/CommandEvent";
import ChannelEntity from "../Database/Entities/ChannelEntity";
import ChatterEntity from "../Database/Entities/ChatterEntity";
import CommandSystem from "../Systems/Commands/CommandSystem";
import PermissionSystem from "../Systems/Permissions/PermissionSystem";
import Permission from "../Systems/Permissions/Permission";
import {Role} from "../Systems/Permissions/Role";
import EntityStateList from "../Database/EntityStateList";
import {appendOrdinal} from "../Utilities/NumberUtils";
import SettingsSystem from "../Systems/Settings/SettingsSystem";
import Setting, {SettingType} from "../Systems/Settings/Setting";
import {chatter as chatterConverter} from "../Systems/Commands/Validator/Chatter";
import {ValidatorStatus} from "../Systems/Commands/Validator/Strategies/ValidationStrategy";
import StandardValidationStrategy from "../Systems/Commands/Validator/Strategies/StandardValidationStrategy";
import {tuple} from "../Utilities/ArrayUtils";

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
        return this.chatters.indexOf(chatter);
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

    constructor() {
        super("queue", "<join|leave|check|pop|peak|clear>");

        this.addSubcommand("join", this.join);
        this.addSubcommand("leave", this.leave);
        this.addSubcommand("pop", this.pop);
        this.addSubcommand("peak", this.peek);
        this.addSubcommand("clear", this.clear);
        this.addSubcommand("open", this.open);
        this.addSubcommand("close", this.close);
    }

    async join({event, message, response}: CommandEventArgs): Promise<void> {
        const {status} = await event.validate(new StandardValidationStrategy({
            usage: "queue join",
            permission: "queue.join"
        }));
         if (status !== ValidatorStatus.OK) return;

        const queue = await this.queues.get(message.getChannel());
        if (!queue.isOpen()) return response.message("queue:error.closed");
        if (queue.find(message.getChatter()) >= 0) return response.message("queue:error.in");
        const maxSize = await message.getChannel().getSetting<number>("queue.max-size");
        if (queue.size() >= maxSize) return response.message("queue:error.full");
        const position = appendOrdinal(queue.push(message.getChatter()));
        await response.message("queue:joined", { position });
    }

    async leave({event, response, message}: CommandEventArgs): Promise<void> {
        const {status} = await event.validate(new StandardValidationStrategy({
            usage: "queue leave",
            permission: "queue.join"
        }));
         if (status !== ValidatorStatus.OK) return;

        const queue = await this.queues.get(message.getChannel());
        if (!queue.isOpen()) return response.message("queue:error.closed");
        if (queue.find(message.getChatter()) < 0) return response.message("queue:error.not-in");
        queue.remove(message.getChatter());
        await response.message("queue:left");
    }

    async check({ event, message, response }: CommandEventArgs): Promise<void> {
        const {status, args} = await event.validate(new StandardValidationStrategy({
            usage: "queue check [user]",
            arguments: tuple(
                chatterConverter({ name: "user", required: false })
            ),
            permission: args => args.length > 0 ? "queue.check.other" : "queue.check"
        }));
         if (status !== ValidatorStatus.OK) return;

        const queue = await this.queues.get(message.getChannel());
        if (!queue.isOpen()) return response.message("queue:error.closed");
        const index = queue.find(args[0] || message.getChatter());
        if (index < 0) return response.message("queue:error.not-in");
        const position = appendOrdinal(index);
        await response.message("queue:check", { username: message.getChatter().name, position });
    }

    async pop({event, message, response}: CommandEventArgs): Promise<void> {
        const {status} = await event.validate(new StandardValidationStrategy({
            usage: "queue pull",
            permission: "queue.pop"
        }));
         if (status !== ValidatorStatus.OK) return;

        const queue = await this.queues.get(message.getChannel());
        if (!queue.isOpen()) return response.message("queue:error.closed");
        const chatter = queue.pop();
        if (chatter === undefined) return response.message("queue:error.empty");
        return response.message("queue.next", { username: chatter.name })
    }

    async peek({event, response, message} : CommandEventArgs): Promise<void> {
        const {status} = await event.validate(new StandardValidationStrategy({
            usage: "queue peek",
            permission: "queue.peek"
        }));
         if (status !== ValidatorStatus.OK) return;

        const queue = await this.queues.get(message.getChannel());
        if (!queue.isOpen()) return response.message("queue:error.closed");
        const chatter = queue.peek();
        if (chatter === undefined) return response.message("queue:error.empty");
        return response.message("queue.next", { username: chatter.name })
    }

    async clear({event, response, message}: CommandEventArgs): Promise<void> {
        const {status} = await event.validate(new StandardValidationStrategy({
            usage: "queue clear",
            permission: "queue.clear"
        }));
         if (status !== ValidatorStatus.OK) return;

        const queue = await this.queues.get(message.getChannel());
        if (!queue.isOpen()) return response.message("queue:error.closed");
        queue.clear();
        return response.message("queue:emptied");
    }

    async open({ event, message, response }: CommandEventArgs): Promise<void> {
        const {status} = await event.validate(new StandardValidationStrategy({
            usage: "queue open",
            permission: "queue.open"
        }));
         if (status !== ValidatorStatus.OK) return;

        const queue = await this.queues.get(message.getChannel());
        if (queue.isOpen()) return response.message("queue:error.open");
        queue.open();
        return response.message("queue:opened", { prefix: await CommandSystem.getPrefix(message.getChannel()) })
    }

    async close({ event, message, response }: CommandEventArgs): Promise<void> {
        const {status} = await event.validate(new StandardValidationStrategy({
            usage: "queue close",
            permission: "queue.close"
        }));
         if (status !== ValidatorStatus.OK) return;

        const queue = await this.queues.get(message.getChannel());
        if (!queue.isOpen()) return response.message("queue:error.closed");
        queue.close();
        return response.message("queue:closed");
    }
}

export default class QueueModule extends AbstractModule {
    constructor() {
        super(QueueModule.name);
    }

    initialize(): void {
        const cmd = CommandSystem.getInstance();
        cmd.registerCommand(new QueueCommand(), this);

        const perm = PermissionSystem.getInstance();
        perm.registerPermission(new Permission("queue.join", Role.NORMAL));
        perm.registerPermission(new Permission("queue.check", Role.NORMAL));
        perm.registerPermission(new Permission("queue.check.other", Role.MODERATOR));
        perm.registerPermission(new Permission("queue.pop", Role.MODERATOR));
        perm.registerPermission(new Permission("queue.peak", Role.MODERATOR));
        perm.registerPermission(new Permission("queue.clear", Role.MODERATOR));
        perm.registerPermission(new Permission("queue.open", Role.MODERATOR));
        perm.registerPermission(new Permission("queue.close", Role.MODERATOR));

        const settings = SettingsSystem.getInstance();
        settings.registerSetting(new Setting("queue.max-size", "30", SettingType.INTEGER));
    }
}