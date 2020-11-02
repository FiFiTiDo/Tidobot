import {addPropertyMetadata, getPropertyMetadata} from "../../../Utilities/DecoratorUtils";
import {CommandEvent} from "../CommandEvent";
import {AsyncResolvable, resolveAsync} from "../../../Utilities/Interfaces/Resolvable";
import {InvalidInputError, MissingRequiredArgumentError, MissingRequiredCliArgumentError} from "./ValidationErrors";
import minimist = require("minimist-string");

const ARGUMENT_META_KEY = "command:argument";
const REST_META_KEY = "command:rest_args";

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
    reducer: AsyncResolvable<CommandEvent, T>;
}

export interface ArgumentConverter<T> {
    type: string;

    convert(input: string, name: string, column: number, event: CommandEvent): AsyncResolvable<void, T>;
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

export function makeEventReducer<T>(reducer: AsyncResolvable<CommandEvent, T>): ParameterDecorator {
    return function (target: any, propertyKey: string, parameterIndex: number): void {
        addPropertyMetadata<EventReducerArgument<T>>(ARGUMENT_META_KEY, target, propertyKey, {parameterIndex, reducer});
    };
}

export const MessageArg = makeEventReducer(event => event.getMessage());
export const ResponseArg = makeEventReducer(event => event.getMessage().getResponse());
export const Sender = makeEventReducer(event => event.getMessage().getChatter());
export const ChannelArg = makeEventReducer(event => event.getMessage().getChannel());

export function RestArguments(required = true, settings: RestSettings = {}): ParameterDecorator {
    return function (target: any, propertyKey: string, parameterIndex: number): void {
        addPropertyMetadata<RestMeta>(REST_META_KEY, target, propertyKey, {parameterIndex, required, settings});
    };
}

function isConverter(o: Record<string, any>): o is ConverterArgument<any> {
    return "converter" in o;
}

function isReducer(o: Record<string, any>): o is EventReducerArgument<any> {
    return "reducer" in o;
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

export async function resolveArguments(event: CommandEvent, target: any, propertyKey: string, usage: string, silent: boolean): any {
    const types = Reflect.getMetadata("design:paramtypes", target, propertyKey) as Record<string, any>[];
    const argumentInfo = getPropertyMetadata<ArgumentMeta[]>(ARGUMENT_META_KEY, target, propertyKey) || [];
    const args = [].fill(undefined, types.length);
    const message = event.getMessage();
    const rawArgs = event.getArguments().slice();
    args[0] = event;

    let column = event.getMessage().getPart(0).length + 1;
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
                        await message.getResponse().rawMessage(await err.getMessage(message, usage));
                    return null;
                } else {
                    if (!silent)
                        await message.getResponse().genericError();
                    return null;
                }
            }
        } else if (isReducer(arg)) {
            args[arg.parameterIndex] = await resolveAsync(arg.reducer, event);
        }
    }

    handleRestArguments(target, propertyKey, args, rawArgs.slice());
    return args;
}


export async function resolveCliArguments(event: CommandEvent, target: any, propertyKey: string, usage: string, silent: boolean) {
    const types = Reflect.getMetadata("design:paramtypes", target, propertyKey) as Record<string, any>[];
    const argumentInfo = getPropertyMetadata<ArgumentMeta[]>(ARGUMENT_META_KEY, target, propertyKey) || [];
    const args = [].fill(undefined, types.length);
    const message = event.getMessage();
    const rawArgs = minimist(event.getArguments().join(" "));
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
                        await message.getResponse().rawMessage(await err.getMessage(message, usage));
                    return null;
                } else {
                    if (!silent)
                        await message.getResponse().genericError();
                    return null;
                }
            }
        } else if (isReducer(arg)) {
            args[arg.parameterIndex] = await resolveAsync(arg.reducer, event);
        }
    }

    handleRestArguments(target, propertyKey, args, rawArgs._ || []);
    return args;
}