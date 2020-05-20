import {
    ExpectedTokenError,
    InvalidInputError,
    InvalidOptionError,
    MissingRequiredArgumentError
} from "./ValidationErrors";
import {array_find} from "../../../Utilities/ArrayUtils";
import {getStartingColumn, ValueConverter, ValueConverterInfo} from "./Converter";

interface StringOptions {
    accepted?: string[];
    greedy?: boolean;
    array?: boolean;
    quoted?: boolean;
    defaultValue?: string;
    required: boolean;
    name: string;
}

interface SingleStringOptions extends StringOptions {
    array?: never;
}

interface MultipleStringOptions extends StringOptions {
    array: true;
}

const QUOTED_STRING_REGEX = /[^"\s]\S*|".+?"/g;

function splitString(line: string): string[] {
    return QUOTED_STRING_REGEX.exec(line) || line.split(" ");
}

export function string(opts: SingleStringOptions): ValueConverterInfo<string>;
export function string(opts: MultipleStringOptions): ValueConverterInfo<string[]>;
export function string(opts: SingleStringOptions|MultipleStringOptions): ValueConverterInfo<string|string[]|null> {
    if (opts.array && opts.greedy)
        throw new InvalidOptionError("String converter unable to be both array and greedy");
    if (opts.greedy && opts.quoted)
        throw new InvalidOptionError("String converter unable to be both greedy and quoted");

    return {
        name: opts.name, required: opts.required,
        converter: function (parts: string[], index: number) {
            if (index >= parts.length) {
                if (opts.required)
                    throw new MissingRequiredArgumentError(opts.name, "string", getStartingColumn(parts, index));
                else
                    return { newIndex: index, converted: opts.defaultValue || null };
            }

            let newIndex = index + 1;
            let converted: string|string[] = parts[index];

            if (opts.array) {
                newIndex = parts.length;
                converted = parts.slice(index, newIndex);
                if (opts.quoted)
                    converted = splitString(converted.join(" "));
            } else if (opts.greedy) {
                newIndex = parts.length;
                converted = parts.slice(index, newIndex).join(" ");
            } else if (opts.quoted) {
                if (!parts[index].startsWith("\""))
                    throw new ExpectedTokenError("opening quote", "\"", getStartingColumn(parts, index));

                let strParts = [];
                let found = false;
                let i;
                for (i = index; i < parts.length; i++) {
                    const curr = parts[i];
                    strParts.push(curr);
                    if (curr.endsWith("\"") && !curr.endsWith("\\\"")) {
                        found = true;
                        break;
                    }
                }
                if (!found)
                    throw new ExpectedTokenError("closing quote", "\"", getStartingColumn(strParts, strParts.length));
                newIndex = i + 1;
                converted = strParts.join(" ").slice(1, -1);
            }

            if (opts.accepted) {
                const values = Array.isArray(converted) ? converted : [converted];
                for (const value of values)
                    if (!array_find(value, opts.accepted))
                        throw new InvalidInputError(`${value} is not an acceptable value`);
            }

            return { newIndex, converted }
        }
    }
}