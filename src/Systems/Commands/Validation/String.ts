import {InvalidInputError} from "./ValidationErrors";
import {ArgumentConverter} from "./Argument";
import _ from "lodash";

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
        if (!_.includes(this.accepted, input))
            throw new InvalidInputError(`${input} is not an acceptable value`);
        return input;
    }
}