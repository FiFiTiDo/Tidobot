import CommandSystem from "./CommandSystem";
import {CommandEvent, CommandEventArgs} from "./CommandEvent";
import ChannelEntity from "../../Database/Entities/ChannelEntity";
import {SubcommandParams} from "./decorators";
import {CommandHandlerFunction, getCommandHandlers} from "./Validation/CommandHandler";

export default class Command {
    private subcommandData: Map<string, SubcommandParams>;
    private readonly commandHandlers: CommandHandlerFunction[];

    constructor(protected label: string, protected usage: string | null, protected aliases: string[] = []) {
        this.commandHandlers = getCommandHandlers(this).map(property => this[property]);
    }

    getLabel(): string {
        return this.label;
    }

    getAliases(): string[] {
        return this.aliases;
    }

    getUserCooldown(subcommand: string): number {
        const data = this.subcommandData.get(subcommand);
        if (!data) return 0;
        return data.userCooldown || 0;
    }

    getGlobalCooldown(subcommand: string): number {
        const data = this.subcommandData.get(subcommand);
        if (!data) return 0;
        return data.globalCooldown || 0;
    }

    async formatUsage(channel: ChannelEntity): Promise<string> {
        let usage = await CommandSystem.getPrefix(channel) + this.label;
        if (this.usage !== null) usage += ` ${this.usage}`;
        return usage;
    }

    async execute(args: CommandEventArgs): Promise<void> {
        const {message, response} = args;

        if (!this.executeCommandHandlers(args.event))
            return response.rawMessage(await this.formatUsage(message.getChannel()));
    }

    protected async executeCommandHandlers(event: CommandEvent) {
        let executed = false;
        for (const commandHandler of this.commandHandlers) {
            if (commandHandler.call(this, event)) executed = true;
        }
        return executed;
    }
}