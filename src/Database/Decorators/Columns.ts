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
        addMetadata<ColumnProp>(COLUMNS_KEY, target.constructor, { property, settings });
    };
}