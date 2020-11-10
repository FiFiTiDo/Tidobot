import {CommandEvent} from "../CommandEvent";
import {resolveArguments, resolveCliArguments} from "./Argument";
import {addMetadata, getMetadata} from "../../../Utilities/DecoratorUtils";
import Event from "../../Event/Event";

const COMMAND_HANDLER_META_KEY = "command:handler";

export interface CommandHandlerFunction {
    (event: CommandEvent, ...args: any[]): Promise<boolean | void>;
}

export function getCommandHandlers(target: any): string[] {
    return getMetadata(COMMAND_HANDLER_META_KEY, target.constructor);
}

export function CommandHandler(match: string | RegExp, usage: string, shiftArgs = 0, silent = false, cliArgs = false) {
    return function (target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<CommandHandlerFunction>): any {
        const originalMethod = descriptor.value;
        descriptor.value = async function (event: Event): Promise<any> {
            const message = event.extra.get(CommandEvent.EXTRA_MESSAGE);

            if (typeof match === "string") {
                if (!message.getRaw().substr(1).startsWith(match)) return false;
            } else {
                if (!message.getRaw().substr(1).match(match)) return false;
            }

            const newEventExtra = event.extra.clone();
            const newEvent = new Event(CommandEvent);
            const newArguments = newEventExtra.get(CommandEvent.EXTRA_ARGUMENTS);
            for (let i = 0; i < shiftArgs; i++) newArguments.shift();
            newEventExtra.put(CommandEvent.EXTRA_ARGUMENTS, newArguments);
            newEvent.extra.putAll(newEventExtra);

            const args = cliArgs ?
                await resolveCliArguments(newEvent, target, propertyKey, usage, silent) :
                await resolveArguments(newEvent, target, propertyKey, usage, silent);
            if (args === null) return false;
            originalMethod.apply(this, args);
            return true;
        };
        addMetadata(COMMAND_HANDLER_META_KEY, target.constructor, propertyKey);
    };
}