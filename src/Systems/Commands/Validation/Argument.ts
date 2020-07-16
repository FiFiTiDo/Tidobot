import {addPropertyMetadata, getPropertyMetadata} from "../../../Utilities/DecoratorUtils";
import {CommandEvent} from "../CommandEvent";
import {Response} from "../../../Chat/Response";
import Message from "../../../Chat/Message";
import ChatterEntity from "../../../Database/Entities/ChatterEntity";
import ChannelEntity from "../../../Database/Entities/ChannelEntity";
import {AsyncResolvable, resolveAsync} from "../../../Utilities/Interfaces/Resolvable";
import {InvalidInputError, MissingRequiredArgumentError} from "./ValidationErrors";

const ARGUMENT_META_KEY = "command:argument";
const REST_META_KEY = "command:rest_args";

interface RestMeta {
    parameterIndex: number;
    required: boolean;
    join: boolean;
}

interface ArgumentMeta {
    parameterIndex: number;
}

interface ConverterArgument<T> extends ArgumentMeta {
    converter: ArgumentConverter<T>
    required: boolean;
    name: string;
}

interface EventReducerArgument<T> extends ArgumentMeta {
    reducer: (event: CommandEvent) => T;
}

export interface ArgumentConverter<T> {
    type: string;
    convert(input: string, name: string, column: number, event: CommandEvent): AsyncResolvable<T>;
}

export function Argument<T>(converter: ArgumentConverter<T>, name?: string = null, required: boolean = true): ParameterDecorator {
    return function (target: any, propertyKey: string, parameterIndex: number): void {
        addPropertyMetadata<ConverterArgument<T>>(ARGUMENT_META_KEY, target, propertyKey, { parameterIndex, converter, name: name ?? propertyKey, required })
    }
}

function makeReducer<T>(reducer: (event: CommandEvent) => T): ParameterDecorator {
    return function (target: any, propertyKey: string, parameterIndex: number): void {
        addPropertyMetadata<EventReducerArgument<Message>>(ARGUMENT_META_KEY, target, propertyKey, { parameterIndex, reducer })
    }
}

export const MessageArg = makeReducer(event => event.getMessage());
export const ResponseArg = makeReducer(event => event.getMessage().getResponse());
export const Sender = makeReducer(event => event.getMessage().getChatter());
export const Channel = makeReducer(event => event.getMessage().getChannel());

export function RestArguments(required: boolean = true, join: boolean = false): ParameterDecorator {
    return function (target: any, propertyKey: string, parameterIndex: number): void {
        addPropertyMetadata<RestMeta>(REST_META_KEY, target, propertyKey, { parameterIndex, required, join })
    }
}

function isConverter(o: Object): o is ConverterArgument {
    return "converter" in o;
}

function isReducer(o: Object): o is EventReducerArgument {
    return "reducer" in o;
}

export async function resolveArguments(event: CommandEvent, target: any, propertyKey: string, usage: string, silent: boolean) {
    const types = Reflect.getMetadata("design:paramtypes", target, propertyKey) as Object[];
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
            args[arg.parameterIndex] = arg.reducer(event);
        }
    }

    const restArgsInfo = getPropertyMetadata<RestMeta[]>(REST_META_KEY, target, propertyKey) || [];
    for (const arg of restArgsInfo) {
        args[arg.parameterIndex] = (arg.join) ? rawArgs.join(" ") : rawArgs;
    }

    return args;
}