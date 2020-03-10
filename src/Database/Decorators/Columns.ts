import {ColumnProp, ColumnSettings, DataTypes} from "../Schema";
import Entity, {EntityConstructor} from "../Entities/Entity";

const columns_map: Map<string, ColumnProp[]> = new Map();
function addColumn(entity: Entity, propertyKey: string, settings: ColumnSettings): void {
    let arr = getColumns(entity);
    arr.push({ property: propertyKey, settings });
    columns_map.set(entity.constructor.name, arr);
}

export function getColumns(entity: Entity|EntityConstructor<any>): ColumnProp[] {
    return columns_map.get(entity instanceof Entity ? entity.constructor.name : entity.name) || [];
}

export function Column(settings: ColumnSettings) {
    return function (target: any, propertyKey: string) {
        addColumn(target, propertyKey, settings);
    }
}

export function Id(target: any, propertyKey: string) {
    addColumn(target, propertyKey, { datatype: DataTypes.INTEGER, increment: true, primary: true });
}
