import {addMetadata, getMetadata} from "../../Utilities/DecoratorUtils";
import AbstractModule, {ModuleConstructor} from "../../Modules/AbstractModule";
import Command from "./Command";
import {CommandListener} from "./CommandSystem";

const COMMAND_META_KEY = "command:auto-register";

export function getCommands<T extends AbstractModule>(moduleConstructor: ModuleConstructor<T>): (string|symbol)[] {
    return getMetadata<(string|symbol)[]>(COMMAND_META_KEY, moduleConstructor) || [];
}

export function command(target: any, property: string|symbol): void {
    addMetadata(COMMAND_META_KEY, target.constructor, property);
}

const SUBCOMMAND_META_KEY = "command:sub:auto-register";
export interface SubcommandParams {
    label: string;
    aliases?: string[];
    userCooldown?: number;
    globalCooldown?: number;
}

export function getSubcommands<T extends Command>(command: T): { [key: string]: SubcommandParams } {
    return getMetadata(SUBCOMMAND_META_KEY, command.constructor);
}

export function Subcommand(param0: SubcommandParams|string, ...aliases: string[]): Function {
    let value: SubcommandParams;
    if (typeof param0 === "string") {
        value = {
            label: param0,
            aliases,
            userCooldown: 0,
            globalCooldown: 0
        };
    } else {
        value = param0;
    }

    return function (target: any, property: string, _: TypedPropertyDescriptor<CommandListener>): any {
        addMetadata(SUBCOMMAND_META_KEY, target.constructor, { key: property, value });
    }
}