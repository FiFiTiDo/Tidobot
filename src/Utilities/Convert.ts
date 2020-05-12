import Message from "../Chat/Message";
import {parseBool} from "./functions";
import ChatterEntity from "../Database/Entities/ChatterEntity";
import {Key} from "./Translator";

type MaybePromise<T> = T | Promise<T>;

interface ValueConverter<T> {
    (raw: string, msg: Message): MaybePromise<T | null>;
}

interface ValueSettings {
    type: string;
}

interface CustomValueSettings<T> extends ValueSettings {
    type: "custom";
    converter: ValueConverter<T>;
}

interface NumberValueSettings extends ValueSettings {
    type: "integer" | "float";
    range?: number | [number, number];
}

interface StringValueSettings extends ValueSettings {
    type: "string";
    accepted?: string[];
}

interface BooleanValueSettings extends ValueSettings {
    type: "boolean";
}

interface ChatterValueSettings extends ValueSettings {
    type: "chatter";
}

export type ValueSettingsTypes = CustomValueSettings<any> | NumberValueSettings | StringValueSettings | BooleanValueSettings | ChatterValueSettings;

function checkRange(val: number, arg: NumberValueSettings): boolean {
    if (!arg.range) return true;
    const [lower, upper] = typeof arg.range === "number" ? [0, arg.range] : arg.range;
    return val >= lower && val < upper;
}

function isAccepted(val: string, arg: StringValueSettings): boolean {
    return arg.accepted ? arg.accepted.indexOf(val) >= 0 : true;
}

export default async (value: string, settings: ValueSettingsTypes, msg: Message): Promise<any> => {
    switch (settings.type) {
        case "custom":
            return settings.converter(value, msg);
        case "boolean":
            return parseBool(value);
        case "integer": {
            const intVal = parseInt(value);
            return checkRange(intVal, settings) ? intVal : null;
        }
        case "float": {
            const floatVal = parseFloat(value);
            return checkRange(floatVal, settings) ? floatVal : null;
        }
        case "string":
            return isAccepted(value, settings) ? value : null;
        case "chatter": {
            let chatter = msg.getChannel().findChatterByName(value);
            if (chatter === null) chatter = await ChatterEntity.findByName(value, msg.getChannel());
            if (chatter === null)
                msg.getResponse().message("user:unknown", { username: value });

            return chatter;
        }
    }
}