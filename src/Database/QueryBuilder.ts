import Database from "./Database";
import {TableBuilder, TableBuilderCallback} from "./Table";
import {Where} from "./BooleanOperations";
import {PreparedRow} from "./PreparedData";
import {DatabaseError, QueryBuilderError, QueryError} from "./DatabaseErrors";

export type RowData = { [key: string]: any };

export abstract class AbstractQuery {
    protected db: Database;

    constructor(db: Database) {
        this.db = db;
    }

    abstract toSql(): string;

    async exec(): Promise<any> {
        return new Promise((resolve, reject) => {
            try {
                const sql = this.toSql();
                this.db.getClient().exec(sql, (err) => {
                    if (err) {
                        reject(new QueryError(sql, err));
                    } else {
                        resolve();
                    }
                });
            } catch (e) {
                reject(e);
            }
        });
    }
}

type whereMethod<T extends WhereQuery<T>> = ((where: Where<T>) => WhereQuery<T>) | (() => Where<T>);
abstract class WhereQuery<T extends WhereQuery<T>> extends AbstractQuery {
    protected _where: Where<T>;

    where(where: Where<any>): this;
    where(): Where<T>;
    where(where?: Where<T>): this|Where<T> {
        if (where) {
            this._where = where;
            return this;
        }

        return this._where;
    }

    protected getPreparedValues(): {} {
        return this._where.getPreparedValues();
    }
}

abstract class PreparedQuery<T extends PreparedQuery<T>> extends WhereQuery<T> {
    async exec(): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                const sql = this.toSql();
                this.db.getClient().run(sql, this.getPreparedValues(), (err) => {
                    if (err) {
                        reject(new QueryError(sql, err));
                    } else {
                        resolve();
                    }
                });
            } catch (e) {
                reject(e);
            }
        });
    }
}

export class SelectQuery extends WhereQuery<SelectQuery> {
    constructor(db: Database, private readonly table: string, private readonly expr: string) {
        super(db);

        this._where = new Where(null, this);
    }

    toSql(): string {
        return `SELECT ${this.expr} FROM ${this.table}${this._where.toString()};`;
    }

    protected postExecute(row: RowData): RowData {
        if (typeof row === "undefined") throw new DatabaseError("Invalid row data");

        return this.db.schema.has(this.table) ? this.db.schema.get(this.table).parseDatabaseRows(row) : row;
    }

    async all(): Promise<RowData[]> {
        return new Promise((resolve, reject) => {
            try {
                const sql = this.toSql();
                this.db.getClient().all(sql, this._where.getPreparedValues(), (err, rows) => {
                    if (err) {
                        reject(new QueryError(sql, err));
                    } else {
                        resolve(rows.map(this.postExecute.bind(this)));
                    }
                });
            } catch (e) {
                reject(e);
            }
        });
    }

    async first(): Promise<RowData|null> {
        return new Promise((resolve, reject) => {
            try {
                const sql = this.toSql();
                this.db.getClient().get(sql, this._where.getPreparedValues(), (err, row) => {
                    if (err) {
                        reject(new QueryError(sql, err));
                    } else {
                        resolve(typeof row === "undefined" ? null : this.postExecute(row));
                    }
                });
            } catch (e) {
                reject(e);
            }
        });
    }
}

class CountQuery extends WhereQuery<CountQuery> {
    private selectQuery: SelectQuery;

    constructor(db: Database, table: string, expr: string) {
        super(db);

        this.selectQuery = new SelectQuery(db, table, `COUNT(${expr}) AS count`);
        this._where = new Where();
    }

    async exec(): Promise<number> {
        return this.selectQuery.where(this._where).all().then(([{count}]) => count);
    }

    toSql(): string {
        return "";
    }
}

class ExistsQuery extends WhereQuery<ExistsQuery> {
    private countQuery: CountQuery;

    constructor(db: Database, table: string, expr: string) {
        super(db);

        this.countQuery = new CountQuery(db, table, expr);
        this._where = new Where();
    }

    async exec(): Promise<boolean> {
        return this.countQuery.where(this._where).exec().then(count => count > 0);
    }

    toSql(): string {
        return "";
    }
}

class DeleteQuery extends PreparedQuery<DeleteQuery> {
    private readonly table: string;

    constructor(db: Database, table: string) {
        super(db);
        this.table = table;
        this._where = new Where();
    }

    toSql(): string {
        return `DELETE FROM ${this.table}${this._where.toString()};`;
    }
}

type ConflictResolutionMethod = "ROLLBACK"|"ABORT"|"FAIL"|"IGNORE"|"REPLACE";
class InsertQuery extends AbstractQuery {
    private readonly table: string;
    private readonly data: PreparedRow[];
    private conflict: string;
    private resolution: ConflictResolutionMethod|null;

    constructor(db: Database, table: string, data: RowData|RowData[]) {
        super(db);
        this.table = table;
        if (!Array.isArray(data)) data = [data];
        this.data = data.map(row => PreparedRow.prepare(row, this.table, this.db));
        if (this.data.length < 1) throw new QueryBuilderError("No data was given to the insert query");
        this.conflict = null;
        this.resolution = null;
    }

    or(action: ConflictResolutionMethod): this {
        this.resolution = action;
        return this;
    }

    toSql(): string {
        return `INSERT${this.resolution === null ? "" : " OR " + this.resolution} INTO ${this.table} (${this.data[0].formatColumns()}) VALUES (${this.data[0].formatKeys()});`;
    }

    async exec(): Promise<number[]> {
        return new Promise((resolve, reject) => {
            try {
                const sql = this.toSql();
                const ids = [];
                const stmt = this.db.getClient().prepare(sql);
                for (const row of this.data) stmt.run(row.formatForRun(), function (err) {
                    if (err) {
                        reject(new QueryError(sql, err));
                    } else {
                        ids.push(this.lastID);
                    }
                });
                stmt.finalize((err ) => {
                    if (err) {
                        reject(new QueryError(sql, err));
                    } else {
                        resolve(ids);
                    }
                });
            } catch (e) {
                reject(e);
            }
        });
    }
}

class UpdateQuery extends PreparedQuery<UpdateQuery> {
    private readonly table: string;
    private readonly data: PreparedRow;

    constructor(db: Database, table: string, data: RowData) {
        super(db);
        this.table = table;
        this.data = PreparedRow.prepare(data, this.table, this.db);
        this._where = new Where(null, this);
        this.data.getKeys().forEach(this._where.addReservedKey.bind(this));
    }

    toSql(): string {
        return `UPDATE ${this.table} SET ${this.data.formatForSet()}${this._where.toString()};`;
    }

    protected getPreparedValues(): {} {
        return Object.assign(super.getPreparedValues(), this.data.formatForRun());
    }
}

class CreateTableQuery extends AbstractQuery {
    private readonly table: string;
    private readonly cb: TableBuilderCallback;
    private notExists: boolean;

    constructor(db: Database, table: string, cb: TableBuilderCallback) {
        super(db);
        this.table = table;
        this.cb = cb;
        this.notExists = false;
    }

    ifNotExists(): this {
        this.notExists = true;
        return this;
    }

    toSql(): string {
        let sql = "CREATE TABLE";
        if (this.notExists) sql += " IF NOT EXISTS";
        return sql + ` ${this.table}(${this.getSchema().toSql()});`;
    }

    getSchema(): TableBuilder {
        const tableBuilder = new TableBuilder();
        this.cb(tableBuilder);
        return tableBuilder;
    }
}

class DropTableQuery extends AbstractQuery {
    private readonly table: string;

    constructor(db: Database, table: string) {
        super(db);
        this.table = table;
    }

    toSql(): string {
        return `DROP TABLE ${this.table};`;
    }
}

export default class QueryBuilder {
    private readonly db: Database;
    private readonly table: string;

    constructor(db: Database, table: string) {
        this.db = db;
        this.table = table;
    }

    select(expr = "*"): SelectQuery {
        return new SelectQuery(this.db, this.table, expr);
    }

    count(expr = "*"): CountQuery {
        return new CountQuery(this.db, this.table, expr);
    }

    exists(expr = "*"): ExistsQuery {
        return new ExistsQuery(this.db, this.table, expr);
    }

    delete(): DeleteQuery {
        return new DeleteQuery(this.db, this.table);
    }

    insert(data: RowData|RowData[]): InsertQuery {
        return new InsertQuery(this.db, this.table, Array.isArray(data) ? data : [data]);
    }

    update(data: RowData): UpdateQuery {
        return new UpdateQuery(this.db, this.table, data);
    }

    create(cb: TableBuilderCallback): CreateTableQuery {
        return new CreateTableQuery(this.db, this.table, cb);
    }

    drop(): DropTableQuery {
        return new DropTableQuery(this.db, this.table);
    }
}