import {onePartConverter, ValueConverterInfo} from "./Converter";
import {InvalidArgumentError, InvalidInputError} from "./ValidationErrors";

interface FloatOptions {
    min?: number;
    max?: number;
    name: string;
    required: boolean;
    defaultValue?: number;
}

export function float(opts: FloatOptions): ValueConverterInfo<number> {
    return onePartConverter(opts.name, "float", opts.required, opts.defaultValue, (part, column) => {
        const float = parseFloat(part);
        if (isNaN(float))
            throw new InvalidArgumentError(opts.name, "float", part, column);

        if (opts.min && float < opts.min)
            throw new InvalidInputError(`Value too low, argument ${opts.name} must be >= ${opts.min}`);

        if (opts.max && float > opts.max)
            throw new InvalidInputError(`Value too high, argument ${opts.name} must be <= ${opts.max}`);

        return float;
    });
}