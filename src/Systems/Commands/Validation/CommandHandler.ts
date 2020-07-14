import {CommandEvent} from "../CommandEvent";
import {resolveArguments} from "./Argument";

const ARGUMENT_META_KEY = "command:handler";

export interface CommandHandlerFunction {
    (event: CommandEvent, ...args: any[]): Promise<void>;
}

export function CommandHandler(label: string, usage: string) {
    return function (target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<CommandHandlerFunction>) {
        const originalMethod = descriptor.value;
        descriptor.value = async function (event: CommandEvent) {
            const args = await resolveArguments(event, target, propertyKey);
            originalMethod.apply(this, args);
        }
    }
}