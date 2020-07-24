import {CommandEvent} from "../CommandEvent";
import {resolveArguments, resolveCliArguments} from "./Argument";
import {addMetadata, getMetadata} from "../../../Utilities/DecoratorUtils";

const COMMAND_HANDLER_META_KEY = "command:handler";

export interface CommandHandlerFunction {
    (event: CommandEvent, ...args: any[]): Promise<boolean | void>;
}

export function getCommandHandlers(target: any): string[] {
    return getMetadata(COMMAND_HANDLER_META_KEY, target.constructor);
}

export function CommandHandler(match: string | RegExp, usage: string, shiftArgs: number = 0, silent: boolean = false, cliArgs: boolean = false) {
    return function (target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<CommandHandlerFunction>) {
        const originalMethod = descriptor.value;
        descriptor.value = async function (event: CommandEvent) {
            if (typeof match === "string") {
                if (!event.getMessage().getRaw().substr(1).startsWith(match)) return false;
            } else {
                if (!event.getMessage().getRaw().substr(1).match(match)) return false
            }

            const newEvent = event.clone();
            for (let i = 0; i < shiftArgs; i++) newEvent.shiftArgument();
            const args = cliArgs ?
                await resolveCliArguments(newEvent, target, propertyKey, usage, silent) :
                await resolveArguments(newEvent, target, propertyKey, usage, silent);
            if (args === null) return false;
            originalMethod.apply(this, args);
            return true;
        };
        addMetadata(COMMAND_HANDLER_META_KEY, target.constructor, propertyKey)
    }
}