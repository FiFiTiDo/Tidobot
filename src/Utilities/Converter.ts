import {parseBool} from "./functions";

export type Converter<FromT, ToT> = (from: FromT) => ToT|Promise<ToT>;

export class ConverterError extends Error {
    constructor(type: string, given: any) {
        super(`Expected type ${type} but was given the value ${given}`);
    }
}

export namespace StringToStringConverter {
    export function func(from: string): Promise<string> | string {
        return from;
    }
}

export namespace StringToIntegerConverter {
    export function func(from: string): Promise<number> | number {
        let intVal = parseInt(from);
        if (isNaN(intVal))
            throw new ConverterError("integer", from);
        return intVal;
    }
}

export namespace StringToFloatConverter {
    export function func(from: string): Promise<number> | number {
        let floatVal = parseFloat(from);
        if (isNaN(floatVal))
            throw new ConverterError("float", from);
        return floatVal;
    }
}

export namespace StringToBooleanConverter {
    export function func(from: string): Promise<boolean> | boolean {
        let boolVal = parseBool(from);
        if (boolVal === null)
            throw new ConverterError("boolean", from);
        return boolVal;
    }
}