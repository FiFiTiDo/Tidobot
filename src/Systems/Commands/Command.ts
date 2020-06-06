import CommandSystem, {CommandListener} from "./CommandSystem";
import {CommandEventArgs} from "./CommandEvent";
import ChannelEntity from "../../Database/Entities/ChannelEntity";
import {getSubcommands} from "./decorators";

export default class Command {
    private subcommands: Map<string, CommandListener>;

    constructor(protected label: string, protected usage: string | null, protected aliases: string[] = []) {
        this.subcommands = new Map();

        for (const [property, labels] of Object.entries(getSubcommands(this)))
            for (const subLabel of labels)
                this.addSubcommand(subLabel, this[property]);
    }

    getLabel(): string {
        return this.label;
    }

    getAliases(): string[] {
        return this.aliases;
    }

    async formatUsage(channel: ChannelEntity): Promise<string> {
        let usage = await CommandSystem.getPrefix(channel) + this.label;
        if (this.usage !== null) usage += ` ${this.usage}`;
        return usage;
    }

    addSubcommand(label: string, listener: CommandListener): void {
        this.subcommands.set(label, listener);
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