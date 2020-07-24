import {addMetadata, getMetadata} from "../../Utilities/DecoratorUtils";
import AbstractModule, {ModuleConstructor} from "../../Modules/AbstractModule";
import Command from "./Command";

const COMMAND_META_KEY = "command:auto-register";

export function getCommands<T extends AbstractModule>(moduleConstructor: ModuleConstructor<T>): (string | symbol)[] {
    return getMetadata<(string | symbol)[]>(COMMAND_META_KEY, moduleConstructor) || [];
}

export function command(target: any, property: string | symbol): void {
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
