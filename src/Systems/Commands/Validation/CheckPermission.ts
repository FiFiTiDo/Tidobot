import Permission from "../../Permissions/Permission";
import {CommandEvent} from "../CommandEvent";
import {CommandHandlerFunction} from "./CommandHandler";
import {Resolvable, resolve} from "../../../Utilities/Interfaces/Resolvable";
import Event from "../../Event/Event";

export default function CheckPermission(perm: Resolvable<Event, Permission>) {
    return function (target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<CommandHandlerFunction>): any {
        const originalMethod: Function = descriptor.value;
        descriptor.value = function (event: Event, ...args: any[]): any {
            const permission = resolve(perm, event);
            if (!event.extra.get(CommandEvent.EXTRA_MESSAGE).checkPermission(permission)) return;
            originalMethod.apply(this, [event, ...args]);
        };
    };
}