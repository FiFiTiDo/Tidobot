import {onePartConverter, ValueConverterInfo} from "./Converter";
import {InvalidArgumentError, InvalidInputError} from "./ValidationErrors";
import {ArgumentConverter} from "./Argument";
import {CommandEvent} from "../CommandEvent";

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

interface Constraints {
    min?: number;
    max?: number;
}

export class IntegerArg implements ArgumentConverter<number> {
    type = "integer";

    constructor(private constraints: Constraints = {}) {}

    convert(input: string, name: string, column: number, event: CommandEvent): number {
        const int = parseInt(input);

        if (isNaN(int))
            throw new InvalidArgumentError(name, this.type, input, column);

        if (this.constraints.min && int < this.constraints.min)
            throw new InvalidInputError(`Value too low, argument ${name} must be >= ${this.constraints.min}`);

        if (this.constraints.max && int > this.constraints.max)
            throw new InvalidInputError(`Value too high, argument ${name} must be <= ${this.constraints.max}`);

        return int;
    }

}