import {addMetadata, getMetadata} from "../../Utilities/DeccoratorUtils";


export enum DataTypes {
    STRING, INTEGER, FLOAT, BOOLEAN, DATE, ARRAY, ENUM
}

export interface ColumnSettings {
    name?: string;
    datatype: DataTypes;
    primary?: boolean;
    null?: boolean;
    unique?: boolean;
    increment?: boolean;
    references?: string;
    enum?: string[];
}

export interface ColumnProp {
    property: string;
    settings: ColumnSettings;
}

const COLUMNS_KEY = "entity:columns";

export function getColumns(target: any): ColumnProp[] {
    return getMetadata<ColumnProp[]>(COLUMNS_KEY, target);
}

export function Column(settings: ColumnSettings): Function {
    return function (target: any, property: string): void {
        if (!settings.name) settings.name = property;
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