import {addMetadata} from "../../Utilities/DecoratorUtils";

export const CONFIG_OPTIONS_KEY = "config:option";

export function ConfigOption(target: any, propertyKey: string): void {
    addMetadata(CONFIG_OPTIONS_KEY, target.constructor, propertyKey);
}