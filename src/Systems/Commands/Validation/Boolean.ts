import {onePartConverter, ValueConverterInfo} from "./Converter";
import {InvalidArgumentError} from "./ValidationErrors";
import {parseBool} from "../../../Utilities/functions";

interface IntegerOptions {
    min?: number;
    max?: number;
    name: string;
    required: boolean;
    defaultValue?: boolean;
}

export function boolean(opts: IntegerOptions): ValueConverterInfo<boolean> {
    return onePartConverter(opts.name, "boolean", opts.required, opts.defaultValue || false, (part, column) => {
        const boolean = parseBool(part);
        if (boolean === null)
            throw new InvalidArgumentError(opts.name, "boolean", part, column);
        return boolean;
    });
}