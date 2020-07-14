import {ValueConverterInfo} from "./Converter";
import {addPropertyMetadata, getPropertyMetadata} from "../../../Utilities/DecoratorUtils";
import {CommandEvent} from "../CommandEvent";
import {Response} from "../../../Chat/Response";
import Message from "../../../Chat/Message";
import ChatterEntity from "../../../Database/Entities/ChatterEntity";
import ChannelEntity from "../../../Database/Entities/ChannelEntity";
import AbstractModule from "../../../Modules/AbstractModule";
import {resolveAsync} from "../../../Utilities/Interfaces/Resolvable";
import {InvalidInputError} from "./ValidationErrors";
import {ValidatorStatus} from "./Strategies/ValidationStrategy";

const ARGUMENT_META_KEY = "command:argument";

interface ArgumentInfo {
    parameterIndex: number;
}

interface ConverterArgument<T> extends ArgumentInfo {
    converter: ValueConverterInfo<T>
}

interface EventReducerArgument<T> extends ArgumentInfo {
    reducer: (event: CommandEvent) => T;
}

export function Argument<T>(converter: ValueConverterInfo<T>): Function {
    return function (target: any, propertyKey: string, parameterIndex: number): void {
        addPropertyMetadata<ConverterArgument<T>>(ARGUMENT_META_KEY, target, propertyKey, { parameterIndex, converter })
    }
}

export function Message(): Function {
    return function (target: any, propertyKey: string, parameterIndex: number): void {
        addPropertyMetadata<EventReducerArgument<Message>>(ARGUMENT_META_KEY, target, propertyKey, { parameterIndex, reducer: event => event.getMessage()})
    }
}

export function Response(): Function {
    return function (target: any, propertyKey: string, parameterIndex: number): void {
        addPropertyMetadata<EventReducerArgument<Response>>(ARGUMENT_META_KEY, target, propertyKey, { parameterIndex, reducer: event => event.getMessage().getResponse()})
    }
}

export function Sender(): Function {
    return function (target: any, propertyKey: string, parameterIndex: number): void {
        addPropertyMetadata<EventReducerArgument<ChatterEntity>>(ARGUMENT_META_KEY, target, propertyKey, { parameterIndex, reducer: event => event.getMessage().getChatter()})
    }
}

export function Channel(): Function {
    return function (target: any, propertyKey: string, parameterIndex: number): void {
        addPropertyMetadata<EventReducerArgument<ChannelEntity>>(ARGUMENT_META_KEY, target, propertyKey, { parameterIndex, reducer: event => event.getMessage().getChannel()})
    }
}

function isConverter(o: Object): o is ConverterArgument {
    return "converter" in o;
}

function isReducer(o: Object): o is EventReducerArgument {
    return "reducer" in o;
}

export async function resolveArguments(event: CommandEvent, target: any, propertyKey: string) {
    const types = Reflect.getMetadata("design:paramtypes", target, propertyKey) as Object[];
    const argumentInfo = getPropertyMetadata<ArgumentInfo[]>(ARGUMENT_META_KEY, target, propertyKey);
    const args = [].fill(undefined, types.length);
    const message = event.getMessage();
    args[0] = event;

    let currIndex = 0;
    for (const arg of argumentInfo) {
        if (isConverter(arg)) {
            try {
                const {newIndex, converted} = await resolveAsync(arg.converter.converter(rawArgs, currIndex, message));
                args[arg.parameterIndex] = converted;
                currIndex = newIndex;
            } catch (err) {
                if (err instanceof InvalidInputError) {
                    if (!silent)
                        await message.getResponse().rawMessage(await err.getMessage(message, this.opts.usage));
                    return {status: ValidatorStatus.INVALID_ARGS, args: null};
                } else {
                    if (!silent)
                        await message.getResponse().genericError();
                    return {status: ValidatorStatus.ERROR, args: null};
                }
            }
        } else if (isReducer(arg)) {
            args[arg.parameterIndex] = arg.reducer(event);
        }
    }

    return args;
}
