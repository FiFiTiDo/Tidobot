import AbstractModule from "./AbstractModule";
import MessageEvent from "../Chat/Events/MessageEvent";
import Message from "../Chat/Message";
import Event from "../Event/Event";
import Channel from "../Chat/Channel";
import {__, parseBool} from "../Utilities/functions";
import Dispatcher from "../Event/Dispatcher";
import Application from "../Application/Application";
import SettingsModule from "./SettingsModule";
import minimist = require("minimist-string");
import {StringToStringConverter} from "../Utilities/Converter";
import User from "../Chat/User";

export type CommandListener = (event: CommandEvent) => void;
type CommandListenerGroup = {
    listener: CommandListener,
    module: AbstractModule
}

export default class CommandModule extends AbstractModule {
    private readonly cmd_listeners: { [key: string]: CommandListenerGroup[] };

    constructor() {
        super(CommandModule.name);

        this.cmd_listeners = {};
        this.coreModule = true;
    }

    initialize() {
        let settings = this.getModuleManager().getModule(SettingsModule);

        settings.registerSetting("command.prefix", "!", StringToStringConverter.func);
    }

    registerListeners(dispatcher: Dispatcher) {
        dispatcher.addListener(MessageEvent, this.onMessage);
    }

    unregisterListeners(dispatcher: Dispatcher) {
        dispatcher.removeListener(MessageEvent, this.onMessage);
    }

    async getPrefix(channel: Channel): Promise<string> {
        return await channel.getSettings().get("command.prefix");
    }

    async showInvalidSyntax(usage: string, msg: Message) {
        let prefix = await this.getPrefix(msg.getChannel());
        await msg.reply(__("general.invalid_syntax", prefix + usage));
    }

    async showInvalidArgument(argument: string, given: any, usage: string, msg: Message) {
        let prefix = await this.getPrefix(msg.getChannel());
        await msg.reply(__("general.invalid_argument", argument, given, prefix + usage));
    }

    onMessage = async (event: MessageEvent) => {
        let message: Message = event.getMessage();
        let command_prefix = await this.getPrefix(message.getChannel());

        if (message.getParts().length < 1) return;
        if (message.getPart(0).startsWith(command_prefix)) {
            let cmd_label = message.getPart(0).toLowerCase().substring(command_prefix.length);
            let event = new CommandEvent(message.getPart(0), message.getParts().slice(1), message);

            this.dispatch(event);
            if (this.cmd_listeners.hasOwnProperty(cmd_label)) {
                for (let listener_group of this.cmd_listeners[cmd_label]) {
                    if (!(await listener_group.module.isDisabled(event.getMessage().getChannel())))
                        listener_group.listener.call(listener_group.module, event);
                }
            }
        }
    };

    registerCommand(label: string, listener: CommandListener, module: AbstractModule) {
        let label_l = label.toLowerCase();

        if (!this.cmd_listeners.hasOwnProperty(label_l)) this.cmd_listeners[label_l] = [];

        this.cmd_listeners[label_l].push({listener, module});
    }
}

interface CommandArgument {
    type: "integer" | "float" | "string" | "special-string" | "boolean" | "chatter" | "user" | "custom",
    required: boolean,
    greedy?: boolean,
    array?: boolean,
    accepted?: string[],
    range?: number|[number, number]
    defaultValue?: string,
    converter?: (raw: string, msg: Message) => any|null|Promise<any|null>,
    silentFail?: boolean,
    key?: string
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
    cli_args: boolean
}

function isCliArgs(arg: any): arg is CliArgsEventValidationOptions {
    return arg.cli_args !== undefined;
}

export class CommandEvent extends Event<CommandEvent> {
    private readonly command: string;
    private readonly args: string[];
    private readonly msg: Message;

    constructor(command: string, args: string[], msg: Message) {
        super(CommandEvent.name);

        this.command = command;
        this.args = args;
        this.msg = msg;
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

    getMessage(): Message {
        return this.msg;
    }

    async validate(opts: CliArgsEventValidationOptions): Promise<{ [key: string]: any }>;
    async validate(opts: CommandEventValidationOptions): Promise<any[]>;
    async validate(opts: CommandEventValidationOptions|CliArgsEventValidationOptions) {
        if (opts.permission && !(await this.msg.checkPermission(opts.permission))) return null;
        if (opts.arguments) {
            let usage = (await Application.getModuleManager().getModule(CommandModule).getPrefix(this.msg.getChannel())) + opts.usage;

            let range = async (i: number|string, arg: CommandArgument, val: number, raw: string): Promise<boolean|null> => {
                if (!arg.range) return true;
                let range = typeof arg.range === "number" ? [0, arg.range] : arg.range;
                if (val >= range[0] && val < range[1]) {
                    args.push(val);
                    return true;
                } else {
                    if (!arg.silentFail) {
                        if (typeof i === "number")
                            await this.msg.reply(__("general.invalid_argument_new", i, `in the range ${range[0]} to ${range[1]}`, raw, usage));
                        else
                            await this.msg.reply(__("general.invalid_cli_arg", i, `in the range ${range[0]} to ${range[1]}`, raw, usage));
                    }
                    return false;
                }
            };

            if (isCliArgs(opts) && opts.cli_args) {
                let parsed = minimist(this.getArguments().slice(1).join(" "));
                let args = {};

                for (let arg of opts.arguments) {
                    if (!arg.key) {
                        Application.getLogger().emerg("Incorrectly configured command, cli arg type requires a key for each arg.");
                        console.trace();
                        return null;
                    }

                    let value;
                    if (parsed.hasOwnProperty(arg.key)) {
                        value = parsed.value;
                    } else {
                        if (arg.required) {
                            if (!arg.silentFail)
                                await this.msg.reply(__("general.expected_cli_arg", arg.key, usage));
                            return null;
                        } else {
                            value = arg.defaultValue || null;
                        }
                    }
                    if (value === null) {
                        args[arg.key] = null;
                        continue;
                    }

                    switch (arg.type) {
                        case "string":
                            if (arg.accepted) {
                                let fail = true;
                                for (let accepted_val of arg.accepted) {
                                    if (value.toLowerCase() === accepted_val.toLowerCase()) {
                                        fail = false;
                                        break;
                                    }
                                }

                                if (fail) {
                                    if (!arg.silentFail)
                                        await this.msg.reply(__("general.invalid_cli_arg", arg.key, `one of: (${arg.accepted.join(", ")})`, value, usage));
                                    return null;
                                }
                            }
                            break;
                        case "integer":
                            let intVal = parseInt(value);
                            if (isNaN(intVal)) {
                                if (!arg.silentFail)
                                    await this.msg.reply(__("general.invalid_cli_arg", arg.key, "an integer", value, usage));
                                return null;
                            }

                            let int_range = await range(arg.key, arg, intVal, value);
                            if (int_range === true) {
                                continue;
                            } else if (int_range === false) {
                                return null;
                            }

                            value = intVal;
                            break;
                        case "float":
                            let floatVal = parseFloat(value);
                            if (isNaN(floatVal)) {
                                if (!arg.silentFail)
                                    await this.msg.reply(__("general.invalid_cli_arg", arg.key, "a float value", value, usage));
                                return null;
                            }

                            let float_range = await range(arg.key, arg, floatVal, value);
                            if (!float_range) return null;
                            value = floatVal;
                            break;
                        case "boolean":
                            let bool = parseBool(value);
                            if (bool === null) {
                                if (!arg.silentFail)
                                    await this.msg.reply(__("general.invalid_cli_arg", arg.key, "a boolean value", value, usage));
                                return null;
                            }
                            value = bool;
                            break;
                        case "chatter":
                            let chatter = Application.getChatterManager().findByName(value, this.msg.getChannel());
                            if (chatter === null) {
                                if (!arg.silentFail)
                                    await this.msg.reply(__("general.user.unknown", args[1]));
                                return null;
                            }
                            value = chatter;
                            break;
                        case "user":
                            let user = await User.findByName(value);
                            if (user === null) {
                                if (!arg.silentFail)
                                    await this.msg.reply(__("general.user.unknown", args[1]));
                                return null;
                            }
                            value = user;
                            break;
                        case "custom":
                            if (!arg.converter) {
                                Application.getLogger().emerg("Incorrectly configured command, custom arg type requires a converter function.");
                                console.trace();
                                return null;
                            }
                            let converted = arg.converter(value, this.msg);
                            try {
                                if (converted instanceof Promise) converted = await converted;
                            } catch (e) {
                                return null;
                            }
                            if (converted === null) return null;
                            value = converted;
                    }
                    args[arg.key] = value;
                }

                return args;
            }

            let args = [];
            for (let i = 0, j = 0; i < opts.arguments.length; i++, j++) {
                let arg = opts.arguments[i];
                let raw = this.getArgument(j);

                if (i >= this.args.length) {
                    if (arg.required) {
                        if (!arg.silentFail)
                            await Application.getModuleManager().getModule(CommandModule).showInvalidSyntax(opts.usage, this.msg);
                        return null;
                    } else if (arg.defaultValue) {
                        raw = arg.defaultValue;
                    } else {
                        break;
                    }
                }

                switch (arg.type) {
                    case "string":
                        let value;
                        if (arg.greedy) {
                            value = this.getArguments().slice(j).join(" ");
                        } else if (arg.array) {
                            value = this.getArguments().slice(j);
                        } else {
                            value = raw;
                        }
                        if (arg.accepted) {
                            let fail = true;
                            for (let accepted_val of arg.accepted) {
                                if (value.toLowerCase() === accepted_val.toLowerCase()) {
                                    args.push(value);
                                    fail = false;
                                    break;
                                }
                            }

                            if (fail) {
                                if (!arg.silentFail)
                                    await this.msg.reply(__("general.invalid_argument_new", i, `one of: (${arg.accepted.join(", ")})`, raw, usage));
                                return null;
                            }
                        } else {
                            args.push(value);
                        }
                        break;
                    case "special-string":
                        let raw_val = this.getArguments().slice(j).join(" ");
                        let start = raw_val.indexOf("\"");
                        let end = raw_val.indexOf("\"", start + 1);
                        let special_string = raw_val.substring(start + 1, end);
                        j += special_string.split(" ").length - 1;
                        args.push(special_string);
                        break;
                    case "integer":
                        let intVal = parseInt(raw);
                        if (isNaN(intVal)) {
                            if (!arg.silentFail)
                                await this.msg.reply(__("general.invalid_argument_new", i, "an integer", raw, usage));
                            return null;
                        }

                        let int_range = await range(i, arg, intVal, raw);
                        if (!int_range) return null;

                        args.push(intVal);
                        break;
                    case "float":
                        let floatVal = parseFloat(raw);
                        if (isNaN(floatVal)) {
                            if (!arg.silentFail)
                                await this.msg.reply(__("general.invalid_argument_new", i, "a float value", raw, usage));
                            return null;
                        }

                        let float_range = await range(i, arg, floatVal, raw);
                        if (!float_range) return null;

                        args.push(floatVal);
                        break;
                    case "boolean":
                        let bool = parseBool(raw);
                        if (bool === null) {
                            if (!arg.silentFail)
                                await this.msg.reply(__("general.invalid_argument_new", i, "a boolean value", raw, usage));
                            return null;
                        }
                        args.push(bool);
                        break;
                    case "chatter":
                        let chatter = Application.getChatterManager().findByName(raw, this.msg.getChannel());
                        if (chatter === null) {
                            if (!arg.silentFail)
                                await this.msg.reply(__("general.user.unknown", args[1]));
                            return null;
                        }
                        args.push(chatter);
                        break;
                    case "user":
                        let user = await User.findByName(raw);
                        if (user === null) {
                            if (!arg.silentFail)
                                await this.msg.reply(__("general.user.unknown", args[1]));
                            return null;
                        }
                        args.push(user);
                        break;
                    case "custom":
                        if (!arg.converter) {
                            Application.getLogger().emerg("Incorrectly configured command, custom arg type requires a converter function.");
                            console.trace();
                            return null;
                        }
                        let converted = arg.converter(raw, this.msg);
                        try {
                            if (converted instanceof Promise) converted = await converted;
                        } catch (e) {
                            return null;
                        }
                        if (converted === null) return null;
                        args.push(converted);
                }
            }
            return args;
        }

        return [];
    }
}

export class SubcommandHelper {
    constructor(private readonly module: AbstractModule, private subcommands: { [key: string]: CommandListener }, private defaultCondition?: CommandListener) {
    }

    handle(event: CommandEvent): boolean {
        if (event.getArgumentCount() < 1) {
            if (this.defaultCondition)
                this.defaultCondition.call(this.module, event);
            return false;
        }

        let subcommand = event.getArgument(0).toLowerCase();

        if (!this.subcommands.hasOwnProperty(subcommand)) {
            if (this.defaultCondition)
                this.defaultCondition.call(this.module, event);
            return false;
        }

        this.subcommands[subcommand].call(this.module, event);
        return true;
    }
}

export module SubcommandHelper {
    export class Builder {
        private readonly subcommands: { [key: string]: CommandListener };
        private defaultCondition: CommandListener;

        constructor() {
            this.subcommands = {};
        }

        addSubcommand(label: string, listener: CommandListener): this {
            this.subcommands[label.toLowerCase()] = listener;
            return this;
        }

        onDefault(listener: CommandListener): this {
            this.defaultCondition = listener;
            return this;
        }

        showUsageOnDefault(usage: string): this {
            return this.onDefault((event) => {
                Application.getModuleManager().getModule(CommandModule).showInvalidSyntax(usage, event.getMessage());
            });
        }

        build(module: AbstractModule): SubcommandHelper {
            return new SubcommandHelper(module, this.subcommands, this.defaultCondition);
        }
    }
}