import CommandSystem from "./CommandSystem";
import {CommandEvent, CommandEventArgs} from "./CommandEvent";
import {CommandHandlerFunction, getCommandHandlers} from "./Validation/CommandHandler";
import AbstractModule from "../../Modules/AbstractModule";
import { Channel } from "../../Database/Entities/Channel";

export default class Command {
    private module: AbstractModule = null;
    private readonly commandHandlers: CommandHandlerFunction[];

    constructor(protected label: string, protected usage: string | null, protected aliases: string[] = []) {
        this.commandHandlers = getCommandHandlers(this).map(property => this[property]);
    }

    setModule(module: AbstractModule): void {
        if (this.module === null) this.module = module;
    }

    getModule(): AbstractModule {
        return this.module;
    }

    getLabel(): string {
        return this.label;
    }

    getAliases(): string[] {
        return this.aliases;
    }

    formatUsage(channel: Channel): string {
        let usage = CommandSystem.getPrefix(channel) + this.label;
        if (this.usage !== null) usage += ` ${this.usage}`;
        return usage;
    }

    execute(args: CommandEventArgs): Promise<void> {
        const {message, response} = args;

        if (!this.executeCommandHandlers(args.event))
            return response.rawMessage(this.formatUsage(message.channel));
    }

    protected executeCommandHandlers(event: CommandEvent): boolean {
        let executed = false;
        for (const commandHandler of this.commandHandlers) {
            if (commandHandler.call(this, event)) executed = true;
        }
        return executed;
    }
}