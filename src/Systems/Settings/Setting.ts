import {parseBool} from "../../Utilities/functions";
import moment from "moment";

export type Integer = number & { __int__: void };
export type Float = number & { __float__: void };

export enum SettingType {
    STRING = "string", INTEGER = "integer", FLOAT = "float", BOOLEAN = "boolean", TIMEZONE = "timezone"
}

export type SettingValueType<T extends SettingType> =
    T extends SettingType.STRING ? string :
        T extends SettingType.INTEGER ? Integer :
            T extends SettingType.FLOAT ? Float :
                T extends SettingType.BOOLEAN ? boolean :
                    T extends SettingType.TIMEZONE ? moment.MomentZone :
                        never;

export type ConvertedSetting = string | Integer | Float | boolean | moment.MomentZone;

export default class Setting<T extends SettingType> {
    constructor(readonly key: string, readonly defaultValue: SettingValueType<T>, readonly type: T) {
    }

    public getKey(): string {
        return this.key;
    }

    public getDefaultValue(): SettingValueType<T> {
        return this.defaultValue;
    }

    public getType(): SettingType {
        return this.type;
    }

    public convert(value: string): SettingValueType<T> {
        switch (this.type) {
            case SettingType.INTEGER: {
                const intVal = parseInt(value) as Integer;
                if (isNaN(intVal)) return null;
                return intVal as SettingValueType<T>;
            }
            case SettingType.FLOAT: {
                const floatVal = parseFloat(value) as Float;
                if (isNaN(floatVal)) return null;
                return floatVal as SettingValueType<T>;
            }
            case SettingType.BOOLEAN:
                return parseBool(value) as SettingValueType<T>;
            case SettingType.TIMEZONE:
                return moment.tz.zone(value) as SettingValueType<T>;
            case SettingType.STRING:
                return value as SettingValueType<T>;
        }
    }
}