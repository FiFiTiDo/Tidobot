import {ValueSettingsTypes} from "../../Utilities/Convert";
export interface CommandArgument {
    value: ValueSettingsTypes;
    required: boolean;
    greedy?: boolean;
    array?: boolean;
    defaultValue?: string;
    silentFail?: boolean;
    key?: string;
    specialString?: boolean;
}

export interface CommandEventValidationOptions {
    usage: string;
    arguments?: CommandArgument[];
    permission?: string;
}

export interface CliArgsEventValidationOptions {
    usage: string;
    arguments: CommandArgument[];
    permission?: string;
    cliArgs: boolean;
}