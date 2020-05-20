import {Resolvable, resolve} from "../../../Utilities/Interfaces/Resolvable";
import {MissingRequiredArgumentError} from "./ValidationErrors";
import Message from "../../../Chat/Message";

interface ConverterResponse<T> {
    newIndex: number;
    converted: T;
}

export interface ValueConverter<T> {
    (parts: string[], index: number, message: Message): Resolvable<void, ConverterResponse<T>>;
}

export interface OnePartValueConverter<T> {
    (part: string, column: number, message: Message): Resolvable<void, T>;
}

export interface ValueConverterInfo<T> {
    name: string;
    required: boolean;
    converter: ValueConverter<T>
}

export function getStartingColumn(parts: string[], index: number) {
    return parts.slice(0, index).reduce((prev, curr) => prev + curr.length, 0) + 1;
}

export function onePartConverter<T>(argument: string, type: string, required: boolean, defaultValue: T = null, converter: OnePartValueConverter<T>): ValueConverterInfo<T|null> {
    return {
        name: argument, required,
        converter: async function(parts, index, message) {
            if (index >= parts.length) {
                if (required)
                    throw new MissingRequiredArgumentError(argument, type, getStartingColumn(parts, index));
                else
                    return {newIndex: index, converted: defaultValue};
            }

            return {
                newIndex: index + 1,
                converted: await resolve(converter(parts[index], getStartingColumn(parts, index), message))
            }
        }
    }
}