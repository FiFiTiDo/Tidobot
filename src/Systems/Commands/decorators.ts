import {addMetadata, getMetadata} from "../../Utilities/DeccoratorUtils";
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

export function getSubcommands<T extends Command>(command: T): { [key: string]: string[] } {
    return getMetadata(SUBCOMMAND_META_KEY, command.constructor);
}

export function Subcommand(...labels: string[]): Function {
    return function (target: any, property: string|symbol, descriptor: TypedPropertyDescriptor<CommandListener>): any {
        addMetadata(SUBCOMMAND_META_KEY, target.constructor, { key: property, value: [...labels] });
    }
}