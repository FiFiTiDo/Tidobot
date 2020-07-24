import {InvalidArgumentError} from "./ValidationErrors";
import {parseBool} from "../../../Utilities/functions";

export class BooleanArg {
    static type = "boolean";

    static convert(input: string, name: string, column: number): boolean {
        const boolean = parseBool(input);
        if (boolean === null)
            throw new InvalidArgumentError(name, this.type, input, column);
        return boolean;
    }
}