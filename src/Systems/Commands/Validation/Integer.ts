import {InvalidArgumentError, InvalidInputError} from "./ValidationErrors";
import {ArgumentConverter} from "./Argument";
import {CommandEvent} from "../CommandEvent";

interface Constraints {
    min?: number;
    max?: number;
}

export class IntegerArg implements ArgumentConverter<number> {
    type = "integer";

    constructor(private constraints: Constraints = {}) {
    }

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