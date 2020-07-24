import {InvalidInputError} from "./ValidationErrors";
import {arrayFind} from "../../../Utilities/ArrayUtils";
import {ArgumentConverter} from "./Argument";
import {CommandEvent} from "../CommandEvent";

export class StringArg {
    static type = "string";

    static convert(input: string, name: string, column: number, event: CommandEvent): string {
        return input;
    }
}

export class StringEnumArg implements ArgumentConverter<string> {
    type: string;

    constructor(private accepted: string[]) {
    }

    convert(input: string, name: string, column: number, event: CommandEvent): string {
        if (!arrayFind(input, this.accepted))
            throw new InvalidInputError(`${input} is not an acceptable value`);
        return input;
    }

}