import {RawRowData} from "./RowData";
import {DatabaseError} from "./DatabaseErrors";
import moment, {Moment} from "moment";
import Entity from "./Entities/Entity";
import {ColumnProp, ColumnSettings, DataTypes, EnumColumnSettings, getColumns} from "./Decorators/Columns";
import {getRelationships} from "./Decorators/Relationships";

export class TableSchema {
    private readonly columns: Map<string, ColumnProp>;

    constructor(private entity: Entity<any>) {
        this.columns = new Map();

        for (const col of getColumns(entity.constructor) as ColumnProp[])
            this.addColumn(col.property, col.settings);
    }

    addColumn(property: string, settings: ColumnSettings): void {
        this.columns.set(settings.name, {property, settings});
    }

    importRow(row: RawRowData): RawRowData {
        for (const columnName of Object.keys(row)) {
            if (!this.columns.has(columnName)) {
                console.table(row);
                console.table(this.columns);
                throw new DatabaseError("Could not parse database rows, column names don't match the schema.");
            }
            const {property, settings} = this.columns.get(columnName);
            const value = row[settings.name];
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
                case DataTypes.ENUM: {
                    const enumSettings = settings as EnumColumnSettings;
                    this.entity[property] = enumSettings.enum[value];
                    break;
                }
                default:
                    this.entity[property] = value;
            }
        }
        return row;
    }

    exportRow(): RawRowData {
        const data = {};
        for (const column of Array.from(this.columns.values())) {
            const {property, settings} = column;
            const value = this.entity[property];
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
                case DataTypes.ENUM: {
                    const enumSettings = settings as EnumColumnSettings;
                    data[settings.name] = enumSettings.enum[value];
                    break;
                }
                default:
                    data[settings.name] = value;
            }
        }
        return data;
    }

    async export(): Promise<RawRowData> {
        const relationshipData = {};
        for (const relationship of getRelationships(this.entity)) {
            const entities = await this.entity[relationship]();
            if (Array.isArray(entities)) {
                relationshipData[relationship] = (entities as Entity<any>[]).map(entity => entity.getSchema().exportRow());
            } else if (entities === null) {
                relationshipData[relationship] = null;
            } else {
                relationshipData[relationship] = (entities as Entity<any>).getSchema().exportRow();
            }
        }
        return Object.assign(this.exportRow(), relationshipData);
    }
}