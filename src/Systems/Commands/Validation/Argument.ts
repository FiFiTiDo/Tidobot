import {addPropertyMetadata, getPropertyMetadata} from "../../../Utilities/DecoratorUtils";
import {AsyncResolvable, Resolvable, resolve, resolveAsync} from "../../../Utilities/Interfaces/Resolvable";
import {InvalidInputError, MissingRequiredArgumentError, MissingRequiredCliArgumentError} from "./ValidationErrors";
import * as minimist from "minimist-string";
import Event from "../../Event/Event";
import { CommandEvent } from "../CommandEvent";
import Message from "../../../Chat/Message";
import { getLogger, logError } from "../../../Utilities/Logger";

const ARGUMENT_META_KEY = "command:argument";
const REST_META_KEY = "command:rest_args";

const logger = getLogger("ArgumentValidator");

interface RestSettings {
    join?: string;
    min?: number;
    max?: number;
}

interface RestMeta {
    parameterIndex: number;
    required: boolean;
    settings: RestSettings;
}

interface ArgumentMeta {
    parameterIndex: number;
}

interface ConverterArgument<T> extends ArgumentMeta {
    converter: ArgumentConverter<T>;
    required: boolean;
    name: string;
}

interface EventReducerArgument<T> extends ArgumentMeta {
    eventReducer: Resolvable<Event, T>;
}

interface MessageReducerArgument<T> extends ArgumentMeta {
    messageReducer: Resolvable<Message, T>;
}

export interface ArgumentConverter<T> {
    type: string;

    convert(input: string, name: string, column: number, event: Event): AsyncResolvable<void, T>;
}

export function Argument<T>(converter: ArgumentConverter<T>, name: string = null, required = true): ParameterDecorator {
    return function (target: any, propertyKey: string, parameterIndex: number): void {
        addPropertyMetadata<ConverterArgument<T>>(ARGUMENT_META_KEY, target, propertyKey, {
            parameterIndex,
            converter,
            name: name ?? propertyKey,
            required
        });
    };
}

export function makeEventReducer<T>(eventReducer: Resolvable<Event, T>): ParameterDecorator {
    return function (target: any, propertyKey: string, parameterIndex: number): void {
        addPropertyMetadata<EventReducerArgument<T>>(ARGUMENT_META_KEY, target, propertyKey, {parameterIndex, eventReducer});
    };
}

export function makeMessageReducer<T>(messageReducer: Resolvable<Message, T>): ParameterDecorator {
    return function (target: any, propertyKey: string, parameterIndex: number): void {
        addPropertyMetadata<MessageReducerArgument<T>>(ARGUMENT_META_KEY, target, propertyKey, {parameterIndex, messageReducer});
    };
}

export const MessageArg = makeEventReducer(event => event.extra.get(CommandEvent.EXTRA_MESSAGE));
export const ResponseArg = makeMessageReducer(message => message.response);
export const Sender = makeMessageReducer(message => message.chatter);
export const ChannelArg = makeMessageReducer(message => message.channel);

export function RestArguments(required = true, settings: RestSettings = {}): ParameterDecorator {
    return function (target: any, propertyKey: string, parameterIndex: number): void {
        addPropertyMetadata<RestMeta>(REST_META_KEY, target, propertyKey, {parameterIndex, required, settings});
    };
}

function isConverter(o: Record<string, any>): o is ConverterArgument<any> {
    return "converter" in o;
}

function isEventReducer(o: Record<string, any>): o is EventReducerArgument<any> {
    return "eventReducer" in o;
}

function isMessageReducer(o: Record<string, any>): o is MessageReducerArgument<any> {
    return "messageReducer" in o;
}

function handleRestArguments(target: any, propertyKey: string, args: (string | string[])[], restArgs: string[]): any {
    const restArgsInfo = getPropertyMetadata<RestMeta[]>(REST_META_KEY, target, propertyKey) || [];
    for (const arg of restArgsInfo) {
        let value: string | string[] = restArgs.slice();

        if (arg.settings.min && value.length < arg.settings.min) {
            return null;
        }

        if (arg.settings.max && value.length > arg.settings.max) {
            return null;
        }

        if (arg.settings.join) value = (value as string[]).join(arg.settings.join);

        args[arg.parameterIndex] = value;
    }
}

export async function resolveArguments(event: Event, target: any, propertyKey: string, usage: string, silent: boolean): Promise<any> {
    const types = Reflect.getMetadata("design:paramtypes", target, propertyKey) as Record<string, any>[];
    const argumentInfo = getPropertyMetadata<ArgumentMeta[]>(ARGUMENT_META_KEY, target, propertyKey) || [];
    const args = [].fill(undefined, types.length);
    const message = event.extra.get(CommandEvent.EXTRA_MESSAGE);
    const rawArgs = event.extra.get(CommandEvent.EXTRA_ARGUMENTS).slice();
    args[0] = event;

    let column = message.getPart(0).length + 1;
    for (const arg of argumentInfo) {
        if (isConverter(arg)) {
            try {
                const part = rawArgs.shift();
                if (part === undefined) {
                    if (arg.required)
                        throw new MissingRequiredArgumentError(arg.name, arg.converter.type, column);
                    break;
                }
                args[arg.parameterIndex] = await resolveAsync(arg.converter.convert(part, arg.name, column, event));
                column += part.length + 1;
            } catch (err) {
                if (err instanceof InvalidInputError) {
                    if (!silent)
                        await message.response.rawMessage(await err.getMessage(message));
                    return null;
                } else {
                    if (!silent)
                        await message.response.genericError();
                    logError(logger, err);
                    return null;
                }
            }
        } else if (isEventReducer(arg)) {
            args[arg.parameterIndex] = resolve(arg.eventReducer, event);
        } else if (isMessageReducer(arg)) {
            args[arg.parameterIndex] = resolve(arg.messageReducer, message);
        }
    }
    handleRestArguments(target, propertyKey, args, rawArgs.slice());
    return args;
}


export async function resolveCliArguments(event: Event, target: any, propertyKey: string, usage: string, silent: boolean): Promise<any> {
    const types = Reflect.getMetadata("design:paramtypes", target, propertyKey) as Record<string, any>[];
    const argumentInfo = getPropertyMetadata<ArgumentMeta[]>(ARGUMENT_META_KEY, target, propertyKey) || [];
    const args = [].fill(undefined, types.length);
    const message = event.extra.get(CommandEvent.EXTRA_MESSAGE);
    const rawArgs = minimist(event.extra.get(CommandEvent.EXTRA_ARGUMENTS).join(" "));
    args[0] = event;

    for (const arg of argumentInfo) {
        if (isConverter(arg)) {
            try {
                if (!Object.prototype.hasOwnProperty.call(rawArgs, arg.name)) {
                    if (arg.required)
                        throw new MissingRequiredCliArgumentError(arg.name, arg.converter.type);
                    break;
                }
                args[arg.parameterIndex] = await resolveAsync(arg.converter.convert(rawArgs[arg.name], arg.name, 0, event));
            } catch (err) {
                if (err instanceof InvalidInputError) {
                    if (!silent)
                        await message.getResponse().rawMessage(await err.getMessage(message));
                    return null;
                } else {
                    if (!silent)
                        await message.getResponse().genericError();
                    logError(logger, err);
                    return null;
                }
            }
        } else if (isEventReducer(arg)) {
            args[arg.parameterIndex] = resolve(arg.eventReducer, event);
        } else if (isMessageReducer(arg)) {
            args[arg.parameterIndex] = resolve(arg.messageReducer, message);
        }
    }

    handleRestArguments(target, propertyKey, args, rawArgs._ || []);
    return args;
}