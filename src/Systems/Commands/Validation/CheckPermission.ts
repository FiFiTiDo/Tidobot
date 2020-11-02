import Permission from "../../Permissions/Permission";
import {CommandEvent} from "../CommandEvent";
import {CommandHandlerFunction} from "./CommandHandler";
import {Resolvable, resolve} from "../../../Utilities/Interfaces/Resolvable";

export default function CheckPermission(perm: Resolvable<CommandEvent, Permission>) {
    return function (target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<CommandHandlerFunction>): any {
        const originalMethod: Function = descriptor.value;
        descriptor.value = function (event: CommandEvent, ...args: any[]): any {
            const permission = resolve(perm, event);
            if (!event.getMessage().checkPermission(permission)) return;
            originalMethod.apply(this, args);
        };
    };
}