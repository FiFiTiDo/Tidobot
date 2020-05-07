import Database from "./Database";
import {RowData} from "./QueryBuilder";

export type PreparedColumn = {
    column: string;
    key: string;
    value: any;
}
export type PreparedData = PreparedColumn[];

export class PreparedRow {
    private readonly data: PreparedData;

    constructor(data: PreparedData) {
        this.data = data;
    }

    formatForRun(): { [key: string]: any } {
        const cols = {};
        for (const col of this.data) cols[col.key] = col.value;
        return cols;
    }

    formatForSet(): string {
        return this.data.map<string>(col => `${col.column} = ${col.key}`).join(", ");
    }

    formatColumns(): string {
        return this.data.map<string>(col => col.column).join(", ");
    }

    formatKeys(): string {
        return this.data.map<string>(col => col.key).join(", ");
    }

    getKeys(): string[] {
        return this.data.map(col => col.key);
    }

    getValues(): any[] {
        return this.data.map(col => col.value);
    }

    static prepare(row: RowData, table: string, db: Database): PreparedRow {
        if (db.schema.has(table))
            row = db.schema.get(table).prepareDatabaseRows(row);

        const data: PreparedData = [];
        for (const [key, value] of Object.entries(row))
            data.push({ key: "$" + key, column: key, value });
        return new PreparedRow(data);
    }
}