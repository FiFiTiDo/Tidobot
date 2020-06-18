import CommandSystem, {CommandListener} from "./CommandSystem";
import {CommandEventArgs} from "./CommandEvent";
import ChannelEntity from "../../Database/Entities/ChannelEntity";
import {getSubcommands, SubcommandParams} from "./decorators";

export default class Command {
    private subcommandData: Map<string, SubcommandParams>;
    private subcommands: Map<string, CommandListener>;

    constructor(protected label: string, protected usage: string | null, protected aliases: string[] = []) {
        this.subcommands = new Map();

        for (const [property, data] of Object.entries(getSubcommands(this))) {
            this.addSubcommand(data.label, this[property], data);
            for (const alias of data.aliases)
                this.addSubcommand(alias, this[property], data);
        }
    }

    getLabel(): string {
        return this.label;
    }

    getAliases(): string[] {
        return this.aliases;
    }

    getCooldown(subcommand: string): number {
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

    addSubcommand(label: string, listener: CommandListener, data: SubcommandParams): void {
        this.subcommands.set(label, listener);
        this.subcommandData.set(label, data);
    }

    async execute(args: CommandEventArgs): Promise<void> {
        const {message, response} = args;
        if (!this.executeSubcommands(args))
            return response.rawMessage(await this.formatUsage(message.getChannel()));
    }

    protected async executeSubcommands(args: CommandEventArgs): Promise<boolean> {
        const newEvent = args.event.clone();
        const subcommandLabel = newEvent.shiftArgument();
        if (!this.subcommands.has(subcommandLabel)) return false;
        this.subcommands.get(subcommandLabel).call(this, Object.assign({}, args, {event: newEvent}));
        return true;
    }
}