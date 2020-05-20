import {CommandEvent} from "../../CommandEvent";
import {ValueConverterInfo} from "../Converter";
import {Resolvable} from "../../../../Utilities/Interfaces/Resolvable";

export enum ValidatorStatus {
    ERROR, INVALID_ARGS, NOT_PERMITTED, OK
}

export interface ValidatorResponse<T> {
    status: ValidatorStatus;
    args: T
}

export interface CommandEventValidatorOptions<T> {
    usage: string;
    arguments?: {
        [K in keyof T]: ValueConverterInfo<T[K]>
    };
    permission?: Resolvable<string[], string>;
    silent?: boolean;
}

export default interface ValidationStrategy<T> {
    validate(event: CommandEvent): Promise<ValidatorResponse<T>>;
}