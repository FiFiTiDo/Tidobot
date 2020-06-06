import {addMetadata, getMetadata} from "../../Utilities/DeccoratorUtils";
import AbstractModule, {ModuleConstructor} from "../../Modules/AbstractModule";

const SETTING_META_KEY = "setting:auto-register";

export function getSettings<T extends AbstractModule>(moduleConstructor: ModuleConstructor<T>): (string|symbol)[] {
    return getMetadata<(string|symbol)[]>(SETTING_META_KEY, moduleConstructor) || [];
}

export function setting(target: any, property: string|symbol): void {
    addMetadata(SETTING_META_KEY, target.constructor, property);
}