import {ColumnProp, ColumnSettings} from "../Schema";
import {addMetadata, getMetadata} from "../../Utilities/DeccoratorUtils";

const COLUMNS_KEY = "entity:columns";

export function getColumns(target: any): ColumnProp[] {
    return getMetadata(COLUMNS_KEY, target);
}

export function Column(settings: ColumnSettings): Function {
    return function (target: any, property: string): void {
        addMetadata<ColumnProp>(COLUMNS_KEY, target, { property, settings });
    };
}