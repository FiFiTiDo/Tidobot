import {onePartConverter, ValueConverterInfo} from "./Converter";
import {InvalidArgumentError, InvalidInputError} from "./ValidationErrors";
import {ArgumentConverter} from "./Argument";
import {CommandEvent} from "../CommandEvent";

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

interface Constraints {
    min?: number;
    max?: number;
}

export class FloatArg implements ArgumentConverter<number> {
    type = "float";

    constructor(private constraints: Constraints = {}) {}

    convert(input: string, name: string, column: number, event: CommandEvent): number {
        const float = parseFloat(input);

        if (isNaN(float))
            throw new InvalidArgumentError(name, this.type, input, column);

        if (this.constraints.min && float < this.constraints.min)
            throw new InvalidInputError(`Value too low, argument ${name} must be >= ${this.constraints.min}`);

        if (this.constraints.max && float > this.constraints.max)
            throw new InvalidInputError(`Value too high, argument ${name} must be <= ${this.constraints.max}`);

        return float;
    }

}