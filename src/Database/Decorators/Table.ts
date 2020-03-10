import {EntityConstructor} from "../Entities/Entity";
import {DataTypes} from "../Schema";
import {getColumns} from "./Columns";
import {formatConstraints} from "./Constraints";

type TableNameFormatter = (service: string, channel: string, optional_param?: string) => string;
const tableName_map: Map<string, TableNameFormatter> = new Map();
export function Table(tableNameFormatter: TableNameFormatter) {
    return function (target: any) {
        tableName_map.set(target.name, tableNameFormatter);
    }
}

export function getTableName(entity_const: EntityConstructor<any>, service: string, channel: string, optional_param?: string) {
    const f = tableName_map.get(entity_const.name);
    if (f === null) return null;
    return f(service, channel, optional_param);
}

export function formatForCreate(entity_const: EntityConstructor<any>) {
    let columns = getColumns(entity_const);
    let constraints = formatConstraints(entity_const);
    let parts = [];
    for (let { settings: column } of columns.values()) {
        let type = "BLOB";
        switch (column.datatype) {
            case DataTypes.INTEGER:
                type = "INTEGER";
                break;
            case DataTypes.FLOAT:
                type = "REAL";
                break;
            case DataTypes.BOOLEAN:
                type = "INTEGER";
                break;
            case DataTypes.STRING:
                type = "TEXT";
                break;
            case DataTypes.ARRAY:
                type = "TEXT";
                break;
            case DataTypes.DATE:
                type = "TEXT";
                break;
            case DataTypes.ENUM:
                type = "TEXT";
                break;
        }

        let part = `${column.name} ${type}`;
        if (!column.null) part += " NOT NULL";
        if (column.unique) part += " UNIQUE";
        if (column.primary) part += " PRIMARY KEY";
        if (column.increment) part += " AUTOINCREMENT";
        if (column.references)
            constraints.push(`CONSTRAINT FOREIGN KEY (${column.name}) REFERENCES ${column.references}`);
        parts.push(part);
    }
    return parts.join(", ");
}