import Entity, {EntityConstructor, EntityParameters} from "../Entities/Entity";
import {DataTypes} from "../Schema";
import {getColumns} from "./Columns";
import {formatConstraints} from "./Constraints";
import {getMetadata, setMetadata} from "../../Utilities/DeccoratorUtils";

const TABLE_NAME_KEY = "entity:table_name";
type TableNameFormatter = (params: EntityParameters) => string;

export function Table(tableNameFormatter: TableNameFormatter): Function {
    return function <T> (target: T): void {
        setMetadata(TABLE_NAME_KEY, target, tableNameFormatter);
    };
}

export function getTableName<T extends Entity>(entityConstructor: EntityConstructor<T>, params: EntityParameters): string|null {
    const formatter = getMetadata<TableNameFormatter>(TABLE_NAME_KEY, entityConstructor);
    if (formatter === null) return null;
    return formatter(params);
}

export function formatForCreate<T extends Entity>(entityConstructor: EntityConstructor<T>): string {
    const columns = getColumns(entityConstructor);
    const constraints = formatConstraints(entityConstructor);
    const parts = [];
    for (const { settings: column } of columns.values()) {
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