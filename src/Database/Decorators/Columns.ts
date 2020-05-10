import {addMetadata, getMetadata} from "../../Utilities/DeccoratorUtils";


export enum DataTypes {
    STRING, INTEGER, FLOAT, BOOLEAN, DATE, ARRAY, ENUM
}

export interface ColumnSettings {
    name?: string;
    datatype?: DataTypes;
    primary?: boolean;
    null?: boolean;
    unique?: boolean;
    increment?: boolean;
    references?: string;
}

export interface EnumColumnSettings extends ColumnSettings {
    datatype: DataTypes.ENUM,
    enum: object
}

type ColumnSettingsTypes = ColumnSettings | EnumColumnSettings;

export interface ColumnProp {
    property: string;
    settings: ColumnSettingsTypes;
}

const COLUMNS_KEY = "entity:columns";

export function getColumns(target: any): ColumnProp[] {
    return getMetadata<ColumnProp[]>(COLUMNS_KEY, target);
}

export function Column(settings: ColumnSettingsTypes = {}): Function {
    return function (target: any, property: string): void {
        if (!settings.name) settings.name = property;
        if (!settings.datatype) {
            const type = Reflect.getMetadata("design:type", target, property);
            switch (type) {
                case "string":
                    settings.datatype = DataTypes.STRING;
                    break;
                case "boolean":
                    settings.datatype = DataTypes.BOOLEAN;
                    break;
                default:
                    throw new Error("Unable to infer column type, please specify using the datatype setting.")
            }
        }

        addMetadata<ColumnProp>(COLUMNS_KEY, target.constructor, { property, settings });
    };
}

export function Id(target: any) {
    addMetadata<ColumnProp>(COLUMNS_KEY, target, {
        property: "id",
        settings: {
            name: "id",
            datatype: DataTypes.INTEGER,
            increment: true,
            primary: true,
            unique: true
        }
    });
}