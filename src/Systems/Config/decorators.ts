import {addMetadata} from "../../Utilities/DeccoratorUtils";

export const CONFIG_OPTIONS_KEY = "config:option";

export function ConfigOption(target: any, propertyKey: string) {
    addMetadata(CONFIG_OPTIONS_KEY, target.constructor, propertyKey);
}