import {addMetadata, getMetadata} from "../../Utilities/DeccoratorUtils";
import AbstractModule, {ModuleConstructor} from "../../Modules/AbstractModule";

const PERMISSIONS_META_KEY = "permissions:auto-register";

export function getPermissions<T extends AbstractModule>(moduleConstructor: ModuleConstructor<T>): (string|symbol)[] {
    return getMetadata<(string|symbol)[]>(PERMISSIONS_META_KEY, moduleConstructor) || [];
}

export function permission(target: any, property: string|symbol): void {
    addMetadata(PERMISSIONS_META_KEY, target.constructor, property);
}