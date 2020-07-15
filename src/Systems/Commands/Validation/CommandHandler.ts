import {CommandEvent} from "../CommandEvent";
import {resolveArguments} from "./Argument";
import {addMetadata, getMetadata} from "../../../Utilities/DecoratorUtils";

const COMMAND_HANDLER_META_KEY = "command:handler";

export interface CommandHandlerFunction {
    (event: CommandEvent, ...args: any[]): Promise<void>;
}

export function getCommandHandlers(target: any): string[] {
    return getMetadata(COMMAND_HANDLER_META_KEY, target.constructor);
}

export function CommandHandler(label: string, usage: string, shiftArgs: number = 0, silent: boolean = false) {
    return function (target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<CommandHandlerFunction>) {
        const originalMethod = descriptor.value;
        descriptor.value = async function (event: CommandEvent) {
            if (!event.getMessage().getRaw().substr(1).startsWith(label)) return;
            const newEvent = event.clone();
            for (let i = 0; i < shiftArgs; i++) newEvent.shiftArgument();
            const args = await resolveArguments(newEvent, target, propertyKey, usage, silent);
            if (args === null) return;
            originalMethod.apply(this, args);
        };
        addMetadata(COMMAND_HANDLER_META_KEY, target.constructor, propertyKey)
    }
}