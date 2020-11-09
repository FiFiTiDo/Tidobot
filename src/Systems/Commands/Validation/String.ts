import {InvalidInputError} from "./ValidationErrors";
import {arrayFind} from "../../../Utilities/ArrayUtils";
import {ArgumentConverter} from "./Argument";

export class StringArg {
    static type = "string";

    static convert(input: string): string {
        return input;
    }
}

export class StringEnumArg implements ArgumentConverter<string> {
    type: string;

    constructor(private accepted: readonly string[]) {
    }

    convert(input: string): string {
        if (!arrayFind(input, this.accepted))
            throw new InvalidInputError(`${input} is not an acceptable value`);
        return input;
    }
}