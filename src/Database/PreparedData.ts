import Database from "./Database";
import {RowData} from "./QueryBuilder";

export type PreparedColumn = {
    column: string,
    key: string,
    value: any
}
export type PreparedData = PreparedColumn[];

export class PreparedRow {
    private readonly data: PreparedData;

    constructor(data: PreparedData) {
        this.data = data;
    }

    formatForRun() {
        let cols = {};
        for (let col of this.data) cols[col.key] = col.value;
        return cols;
    }

    formatForSet() {
        return this.data.map<string>(col => `${col.column} = ${col.key}`).join(", ");
    }

    formatColumns() {
        return this.data.map<string>(col => col.column).join(", ");
    }

    formatKeys() {
        return this.data.map<string>(col => col.key).join(", ");
    }

    getKeys() {
        return this.data.map(col => col.key);
    }

    getValues() {
        return this.data.map(col => col.value);
    }

    static prepare(row: RowData, table: string, db: Database) {
        if (db.schema.has(table))
            row = db.schema.get(table).prepareDatabaseRows(row);

        let data: PreparedData = [];
        for (let [key, value] of Object.entries(row))
            data.push({ key: "$" + key, column: key, value });
        return new PreparedRow(data);
    }
}