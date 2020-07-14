import {onePartConverter, ValueConverterInfo} from "./Converter";
import {InvalidArgumentError, InvalidInputError} from "./ValidationErrors";

interface IntegerOptions {
    min?: number;
    max?: number;
    name: string;
    required: boolean;
    defaultValue?: number;
}

export function integer(opts: IntegerOptions): ValueConverterInfo<number> {
    return onePartConverter(opts.name, "integer", opts.required, opts.defaultValue, (part, column) => {
       const int = parseInt(part);
       if (isNaN(int))
           throw new InvalidArgumentError(opts.name, "integer", part, column);

       if (opts.min && int < opts.min)
           throw new InvalidInputError(`Value too low, argument ${opts.name} must be >= ${opts.min}`);

        if (opts.max && int > opts.max)
            throw new InvalidInputError(`Value too high, argument ${opts.name} must be <= ${opts.max}`);

       return int;
    });
}