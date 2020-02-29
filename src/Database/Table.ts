import {QueryBuilderError, RowData} from "./QueryBuilder";
import {DataTypes} from "./Database";
import moment from "moment";
import { DatabaseError } from "./DatabaseErrors";

export type TableBuilderCallback = (table: TableBuilder) => void;
type ColumnSettings = { name: string, datatype: DataTypes, primary?: boolean, null?: boolean, unique?: boolean, increment?: boolean, references?: string, enum?: string[] };

export default class Table {
    public readonly name: string;
    public readonly columns: ColumnSettings[];
    private readonly columnNames: string[];

    constructor(name: string, columns: ColumnSettings[]) {
        this.name = name;
        this.columns = columns;
        this.columnNames = this.columns.map(col => col.name);
    }

    parseDatabaseRows(row: RowData): RowData {
        for (let columnName of Object.keys(row)) {
            if (columnName === "count") continue;
            let i = this.columnNames.indexOf(columnName);
            if (i < 0)
                throw new DatabaseError("Could not parse database rows, column names don't match the schema.");
            let column = this.columns[i];
            switch (column.datatype) {
                case DataTypes.BOOLEAN:
                    row[column.name] = (row[column.name] as number) === 1;
                    break;
                case DataTypes.ARRAY:
                    row[column.name] = (row[column.name] as string).split(",");
                    break;
                case DataTypes.DATE:
                    row[column.name] = moment(row[column.name] as string);
                    break;
            }
        }
        return row;
    }

    prepareDatabaseRows(row: RowData): RowData {
        for (let columnName of Object.keys(row)) {
            let i = this.columnNames.indexOf(columnName);
            if (i < 0) {
                console.table(row);
                console.table(this.columns);
                throw new DatabaseError("Could not parse database rows, column names don't match the schema.");
            }
            let column = this.columns[i];
            switch (column.datatype) {
                case DataTypes.BOOLEAN:
                    row[column.name] = (row[column.name] as boolean) ? 1 : 0;
                    break;
                case DataTypes.ARRAY:
                    row[column.name] = (row[column.name] as any[]).join(",");
                    break;
                case DataTypes.DATE:
                    row[column.name] = (row[column.name] as moment.Moment).toISOString();
                    break;
                case DataTypes.ENUM:
                    if (!column.enum || column.enum.indexOf(row[column.name]) < 0)
                        throw new DatabaseError("Invalid enum type, either wrong value was specified or no enum values were found.");
                    break;
            }
        }
        return row;
    }
}

export class TableBuilder {
    private columns: ColumnSettings[];
    private constraints: string[];

    constructor() {
        this.columns = [];
        this.constraints = [];
        this.increments("id");
    }

    increments(name: string) {
        this.integer(name).primary().autoIncrement();
        return this;
    }

    string(name: string) {
        this.columns.push({ name, datatype: DataTypes.STRING });
        return this;
    }

    integer(name: string) {
        this.columns.push({ name, datatype: DataTypes.INTEGER });
        return this;
    }

    float(name: string) {
        this.columns.push({ name, datatype: DataTypes.FLOAT });
        return this;
    }

    boolean(name: string) {
        this.columns.push({ name, datatype: DataTypes.BOOLEAN });
        return this;
    }

    date(name: string) {
        this.columns.push({ name: name, datatype: DataTypes.DATE });
        return this;
    }

    array(name: string) {
        this.columns.push({ name: name, datatype: DataTypes.ARRAY });
        return this;
    }

    enum(name: string, types: string[]) {
        this.columns.push({ name: name, datatype: DataTypes.ENUM, enum: types });
        return this;
    }

    timestamps() {
        this.date("created_at");
        this.date("updated_at");
        return this;
    }

    unique(name?: string, columns?: string[]) {
        if (name && columns) {
            this.addConstraint(name, `UNIQUE (${columns.join(", ")})`);
            return this;
        }

        if (this.columns.length < 1) throw new QueryBuilderError("unique() must be called after adding a column.");
        this.columns[this.columns.length - 1].unique = true;
        return this;
    }

    nullable() {
        if (this.columns.length < 1) throw new QueryBuilderError("nullable() must be called after adding a column.");
        this.columns[this.columns.length - 1].null = true;
        return this;
    }

    primary() {
        if (this.columns.length < 1) throw new QueryBuilderError("primary() must be called after adding a column.");
        this.columns[this.columns.length - 1].primary = true;
        return this;
    }

    references(table: string, column: string) {
        if (this.columns.length < 1) throw new QueryBuilderError("references() must be called after adding a column.");
        this.columns[this.columns.length - 1].references = `${table}(${column})`;
        return this;
    }

    autoIncrement() {
        if (this.columns.length < 1) throw new QueryBuilderError("autoIncrement() must be called after adding a column.");
        this.columns[this.columns.length - 1].increment = true;
        return this;
    }

    addConstraint(name: string, sql: string) {
        this.constraints.push(`CONSTRAINT ${name} ${sql}`);
        return this;
    }

    build(name: string) {
        return new Table(name, this.columns);
    }

    toSql() {
        let parts = [];
        let constraints = this.constraints.slice();
        for (let column of this.columns) {
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
                constraints.push(`FOREIGN KEY (${column.name}) REFERENCES ${column.references}`);
            parts.push(part);
        }
        return parts.concat(constraints).join(", ");
    }

    import(table: Table) {
        this.columns = table.columns;
    }
}