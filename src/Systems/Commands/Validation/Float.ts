import {InvalidArgumentError, InvalidInputError} from "./ValidationErrors";
import {ArgumentConverter} from "./Argument";

interface Constraints {
    min?: number;
    max?: number;
}

export class FloatArg implements ArgumentConverter<number> {
    type = "float";

    constructor(private constraints: Constraints = {}) {
    }

    convert(input: string, name: string, column: number): number {
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