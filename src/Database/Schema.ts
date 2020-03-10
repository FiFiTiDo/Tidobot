import {RawRowData} from "./RowData";
import {DatabaseError} from "./DatabaseErrors";
import moment, {Moment} from "moment";
import Entity from "./Entities/Entity";
import {getColumns} from "./Decorators/Columns";
import {getRelationships} from "./Decorators/Relationships";

export enum DataTypes {
    STRING, INTEGER, FLOAT, BOOLEAN, DATE, ARRAY, ENUM
}

export interface ColumnSettings {
    name?: string,
    datatype: DataTypes,
    primary?: boolean,
    null?: boolean,
    unique?: boolean,
    increment?: boolean,
    references?: string,
    enum?: string[]
}

export type ColumnProp = {
    property: string;
    settings: ColumnSettings
};

export class TableSchema {
    private readonly columns: Map<string, ColumnProp>;

    constructor(private entity: Entity) {
        this.columns = new Map();

        for (let col of getColumns(entity) as ColumnProp[]) {
            this.addColumn(col.property, col.settings);
        }
    }

    addColumn(property: string, settings: ColumnSettings) {
        if (!settings.name) settings.name = property;

        this.columns.set(settings.name, { property, settings });
    }

    importRow(row: RawRowData) {
        for (let columnName of Object.keys(row)) {
            if (!this.columns.has(columnName)) {
                console.table(row);
                console.table(this.columns);
                throw new DatabaseError("Could not parse database rows, column names don't match the schema.");
            }
            let { property, settings } = this.columns.get(columnName);
            let value = row[settings.name];
            switch (settings.datatype) {
                case DataTypes.BOOLEAN:
                    this.entity[property] = (value as number) === 1;
                    break;
                case DataTypes.ARRAY:
                    this.entity[property] = (value as string).split(",");
                    break;
                case DataTypes.DATE:
                    this.entity[property] = moment(value as string);
                    break;
                default:
                    this.entity[property] = value;
            }
        }
        return row;
    }

    exportRow(): RawRowData {
        let data = {};
        for (let column of Array.from(this.columns.values())) {
            let { property, settings } = column;
            let value = this.entity[property];
            switch (settings.datatype) {
                case DataTypes.BOOLEAN:
                    data[settings.name] = (value as boolean) ? 1 : 0;
                    break;
                case DataTypes.ARRAY:
                    data[settings.name] = (value as any[]).join(",");
                    break;
                case DataTypes.DATE:
                    data[settings.name] = (value as Moment).toISOString();
                    break;
                case DataTypes.ENUM:
                    if (!settings.enum || settings.enum.indexOf(value) < 0)
                        throw new DatabaseError("Invalid enum type, either wrong value was specified or no enum values were found.");
                    data[settings.name] = value;
                    break;
                default:
                    data[settings.name] = value;
            }
        }
        return data;
    }

    async export() {
        let relationship_data = {};
        for (let relationship of getRelationships(this.entity.constructor.name)) {
            let entities = await this.entity[relationship]();
            if (Array.isArray(entities)) {
                relationship_data[relationship] = (entities as Entity[]).map(entity => entity.getSchema().exportRow());
            } else if (entities === null) {
                relationship_data[relationship] = null;
            } else {
                relationship_data[relationship] = (entities as Entity).getSchema().exportRow();
            }
        }
        return Object.assign(this.exportRow(), relationship_data);
    }
}