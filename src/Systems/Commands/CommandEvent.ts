import Event from "../Event/Event";
import Message, {Response} from "../../Chat/Message";
import Logger from "../../Utilities/Logger";
import {objectHasProperties} from "../../Utilities/ObjectUtils";
import {Key} from "../../Utilities/Translator";
import Convert from "../../Utilities/Convert";
import CommandSystem from "./CommandSystem";
import minimist = require("minimist-string");
import {CliArgsEventValidationOptions, CommandEventValidationOptions} from "./Interfaces";

function isCliArgs(arg: any): arg is CliArgsEventValidationOptions {
    return arg.cli_args !== undefined;
}

export interface CommandEventArgs {
    event: CommandEvent;
    message: Message;
    response: Response;
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
            const usage = (await CommandSystem.getPrefix(this.msg.getChannel())) + opts.usage;

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
                        if (!arg.silentFail) await CommandSystem.showInvalidSyntax(opts.usage, this.msg);
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
                        await CommandSystem.showInvalidSyntax(opts.usage, this.msg);
                    return null;
                }
                args.push(value);
            }
            return args;
        }

        return [];
    }
}