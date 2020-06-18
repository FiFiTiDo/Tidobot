import {CommandEvent} from "../../CommandEvent";
import {ValueConverterInfo} from "../Converter";
import {Resolvable} from "../../../../Utilities/Interfaces/Resolvable";
import Permission from "../../../Permissions/Permission";
import {Float} from "../../../Settings/Setting";
import Command from "../../Command";
import CommandEntity from "../../../../Database/Entities/CommandEntity";

export enum ValidatorStatus {
    ERROR, INVALID_ARGS, NOT_PERMITTED, LOW_BALANCE, OK
}

export interface ValidatorResponse<T> {
    status: ValidatorStatus;
    args: T
}

export interface CommandEventValidatorOptions<T> {
    usage: string;
    subcommand?: string;
    arguments?: {
        [K in keyof T]: ValueConverterInfo<T[K]>
    };
    permission?: Resolvable<string[], string|Permission>;
    price?: Float;
    silent?: boolean;
}

export default interface ValidationStrategy<T> {
    validate(event: CommandEvent): Promise<ValidatorResponse<T>>;
}