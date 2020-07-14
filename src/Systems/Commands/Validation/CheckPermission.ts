import Permission from "../../Permissions/Permission";
import {CommandEvent} from "../CommandEvent";
import {CommandHandlerFunction} from "./CommandHandler";

export default function CheckPermission(permission: string|Permission) {
    return function (target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<CommandHandlerFunction>) {
        const originalMethod: Function = descriptor.value;
        descriptor.value = function (event: CommandEvent, ...args: any[]) {
            if (!event.getMessage().checkPermission(permission)) return;
            originalMethod.apply(this, arguments);
        }
    }
}