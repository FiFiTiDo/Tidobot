import AbstractModule from "./AbstractModule";
import MessageEvent from "../Chat/Events/MessageEvent";
import Message from "../Chat/Message";
import Event, {EventArguments} from "../Systems/Event/Event";
import ChannelEntity from "../Database/Entities/ChannelEntity";
import Response from "../Chat/Response";
import {Key} from "../Utilities/Translator";
import Convert, {ValueSettingsTypes} from "../Utilities/Convert";
import {injectable} from "inversify";
import Logger from "../Utilities/Logger";
import SettingsSystem from "../Systems/Settings/SettingsSystem";
import Setting, {SettingType} from "../Systems/Settings/Setting";
import {objectHasProperties} from "../Utilities/ObjectUtils";
import {EventHandler} from "../Systems/Event/decorators";
import minimist = require("minimist-string");
import EventSystem from "../Systems/Event/EventSystem";

export interface CommandListener {
    (event: CommandEventArgs): void;
}

export interface CommandGroup {
    command: Command;
    module: AbstractModule;
}

@injectable()
export default class CommandModule extends AbstractModule {
    private readonly commandListeners: { [key: string]: CommandGroup[] };

    constructor() {
        super(CommandModule.name);

        this.commandListeners = {};
        this.coreModule = true;
    }

    initialize(): void {
        const settings = SettingsSystem.getInstance();
        settings.registerSetting(new Setting("command.prefix", "!", SettingType.STRING));
    }

    static async getPrefix(channel: ChannelEntity): Promise<string> {
        return await channel.getSettings().get("command.prefix");
    }

    static async showInvalidSyntax(usage: string, msg: Message): Promise<void> {
        const prefix = await CommandModule.getPrefix(msg.getChannel());
        await msg.getResponse().message(Key("general.invalid_syntax"), prefix + usage);
    }

    static async showInvalidArgument(argument: string, given: any, usage: string, msg: Message): Promise<void> {
        const prefix = await CommandModule.getPrefix(msg.getChannel());
        await msg.getResponse().message(Key("general.invalid_argument"), argument, given, prefix + usage);
    }

    @EventHandler(MessageEvent)
    async handleMessage({event}: EventArguments<MessageEvent>): Promise<void> {
        const message: Message = event.getMessage();
        const commandPrefix = await CommandModule.getPrefix(message.getChannel());

        if (message.getParts().length < 1) return;
        if (message.getPart(0).startsWith(commandPrefix)) {
            const commandLabel = message.getPart(0).toLowerCase().substring(commandPrefix.length);
            const event = new CommandEvent(message.getPart(0), message.getParts().slice(1), message);

            EventSystem.getInstance().dispatch(event);
            if (objectHasProperties(this.commandListeners, commandLabel))
                for (const commandGroup of this.commandListeners[commandLabel])
                    if (!commandGroup.module.isDisabled(event.getMessage().getChannel()))
                        await commandGroup.command.execute(event.getEventArgs());
        }
    }

    registerCommand(command: Command, module: AbstractModule): void {
        const register = (label: string): void => {
            if (!objectHasProperties(this.commandListeners, label)) this.commandListeners[label] = [];
            this.commandListeners[label].push({ command, module });
        };

        register(command.getLabel().toLowerCase());
        for (const alias of command.getAliases())
            register(alias.toLowerCase());
    }
}

interface CommandArgument {
    value: ValueSettingsTypes;
    required: boolean;
    greedy?: boolean;
    array?: boolean;
    defaultValue?: string;
    silentFail?: boolean;
    key?: string;
    specialString?: boolean;
}


interface CommandEventValidationOptions {
    usage: string;
    arguments?: CommandArgument[];
    permission?: string;
}

interface CliArgsEventValidationOptions {
    usage: string;
    arguments: CommandArgument[];
    permission?: string;
    cliArgs: boolean;
}

function isCliArgs(arg: any): arg is CliArgsEventValidationOptions {
    return arg.cli_args !== undefined;
}

export interface CommandEventArgs {
    event: CommandEvent;
    message: Message;
    response: Response;
}

export interface CommandEventFactory {
    (command: string, args: string[], msg: Message): CommandEvent;
}

export class CommandEvent extends Event<CommandEvent> {
    constructor(private readonly command: string, private readonly args: string[], private readonly msg: Message) {
        super(CommandEvent.name);
    }

    public getEventArgs(): CommandEventArgs {
        return {
            event: this,
            message: this.msg,
            response: this.msg.getResponse()
        };
    }

    getCommand(): string {
        return this.command;
    }

    getArgument(i: number): string {
        return this.args[i];
    }

    getArguments(): string[] {
        return this.args;
    }

    getArgumentCount(): number {
        return this.args.length;
    }

    shiftArgument(): string {
        return this.args.shift();
    }

    getMessage(): Message {
        return this.msg;
    }

    clone(): CommandEvent {
        return new CommandEvent(this.command, this.args.slice(), this.msg);
    }

    async validate(opts: CliArgsEventValidationOptions): Promise<{ [key: string]: any }|null>;
    async validate(opts: CommandEventValidationOptions): Promise<any[]|null>;
    async validate(opts: CommandEventValidationOptions | CliArgsEventValidationOptions): Promise<{ [key: string]: any }|any[]|null> {
        const response = this.msg.getResponse();
        if (opts.permission && !(await this.msg.checkPermission(opts.permission))) return null;
        if (opts.arguments) {
            const usage = (await CommandModule.getPrefix(this.msg.getChannel())) + opts.usage;

            if (isCliArgs(opts) && opts.cliArgs) {
                const parsed = minimist(this.getArguments().slice(1).join(" "));
                const args = {};

                for (const arg of opts.arguments) {
                    if (!arg.key) {
                        Logger.get().emerg("Incorrectly configured command, cli arg type requires a key for each arg.");
                        console.trace();
                        return null;
                    }

                    let value;
                    if (objectHasProperties(parsed, arg.key)) {
                        value = parsed.value;
                    } else {
                        if (arg.required) {
                            if (!arg.silentFail)
                                await response.message(Key("general.expected_cli_arg"), arg.key, usage);
                            return null;
                        } else
                            value = arg.defaultValue || null;
                    }

                    args[arg.key] = value === null ? null : await Convert(value, arg.value, this.msg);
                }

                return args;
            }

            const args = [];
            for (let i = 0, j = 0; i < opts.arguments.length; i++, j++) {
                const arg = opts.arguments[i];
                let raw = this.getArgument(j);

                if (i >= this.args.length) {
                    if (arg.required) {
                        if (!arg.silentFail) await CommandModule.showInvalidSyntax(opts.usage, this.msg);
                        return null;
                    } else if (arg.defaultValue)
                        raw = arg.defaultValue;
                    else
                        break;
                }

                let value = await Convert(raw, arg.value, this.msg);
                if (arg.value.type === "string") {
                    if (arg.greedy) {
                        value = this.getArguments().slice(j).join(" ");
                    } else if (arg.array) {
                        value = this.getArguments().slice(j);
                    } else if (arg.specialString) {
                        const rawVal = this.getArguments().slice(j).join(" ");
                        const start = rawVal.indexOf("\"");
                        const end = rawVal.indexOf("\"", start + 1);
                        const rawValue = rawVal.substring(start + 1, end);
                        j += rawValue.split(" ").length - 1;
                        value = rawValue;
                    }
                }
                if (value === null) {
                    if (!arg.silentFail)
                        await CommandModule.showInvalidSyntax(opts.usage, this.msg);
                    return null;
                }
                args.push(value);
            }
            return args;
        }

        return [];
    }
}

export class Command {
    private subcommands: Map<string, CommandListener>;

    constructor(protected label: string, protected usage: string | null, protected aliases: string[] = []) {
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