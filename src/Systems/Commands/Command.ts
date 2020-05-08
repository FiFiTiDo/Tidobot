import {CommandListener} from "./CommandSystem";
import {CommandEventArgs} from "./CommandEvent";

export default class Command {
    private subcommands: Map<string, CommandListener>;

    constructor(protected label: string, protected usage: string | null, protected aliases: string[] = []) {
        this.subcommands = new Map();
    }

    getLabel(): string {
        return this.label;
    }

    getAliases(): string[] {
        return this.aliases;
    }

    getUsage(): string {
        return this.usage;
    }

    formatUsage(): string {
        let usage = this.label;
        if (this.usage !== null) usage += ` ${this.usage}`;
        return usage;
    }

    addSubcommand(label: string, listener: CommandListener): void {
        this.subcommands.set(label, listener);
    }

    execute(args: CommandEventArgs): Promise<void> {
        const { event, response } = args;
        const subcommandLabel = event.getArgument(0);
        if (this.subcommands.has(subcommandLabel))
            this.subcommands.get(subcommandLabel).call(this, args);
        else
            return response.message(this.formatUsage());
    }
}