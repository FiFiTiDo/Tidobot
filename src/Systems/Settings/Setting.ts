import {parseBool} from "../../Utilities/functions";
import moment from "moment";

export enum SettingType {
    STRING, INTEGER, FLOAT, BOOLEAN, TIMEZONE
}

export type ConvertedSetting = string | number | boolean | moment.MomentZone;

export default class Setting {
    constructor(private readonly key: string, private readonly defaultValue: string, private readonly type: SettingType) {
    }

    public getKey(): string {
        return this.key;
    }

    public getDefaultValue(): string {
        return this.defaultValue;
    }

    public getType(): SettingType {
        return this.type;
    }

    public convert(value: string): ConvertedSetting {
        switch (this.type) {
            case SettingType.INTEGER: {
                const intVal = parseInt(value);
                if (isNaN(intVal)) return null;
                return intVal;
            }
            case SettingType.FLOAT: {
                const floatVal = parseFloat(value);
                if (isNaN(floatVal)) return null;
                return floatVal;
            }
            case SettingType.BOOLEAN:
                return parseBool(value);
            case SettingType.TIMEZONE:
                return moment.tz.zone(value);
            default:
                return value;
        }
    }
}