import {TableSchema} from "../Schema";
import {prepareData, RawRowData, RawRowDataWithId} from "../RowData";
import moment from "moment";
import {Where, where} from "../Where";
import {formatForCreate, getTableName} from "../Decorators/Table";
import {Serializable} from "../../Utilities/Patterns/Serializable";
import {objectHasProperties} from "../../Utilities/ObjectUtils";
import Database from "../Database";
import {DataTypes} from "../Decorators/Columns";

export interface EntityConstructor<T extends Entity<T>>{
    new (id: number, params: EntityParameters): T;

    normalizeParameters(EntityParameters): EntityParameters;

    get<T extends Entity<T>>(this: EntityConstructor<T>, id: number, params: EntityParameters): Promise<T|null>;
    getAll<T extends Entity<T>>(this: EntityConstructor<T>, params: EntityParameters): Promise<T[]>;
    createTable<T extends Entity<T>>(this: EntityConstructor<T>, params: EntityParameters): Promise<void>;

    dropTable<T extends Entity<T>>(this: EntityConstructor<T>, params: EntityParameters): Promise<void>;

    make<T extends Entity<T>>(this: EntityConstructor<T>, params: EntityParameters, data: RawRowData): Promise<T|null>;
    make<T extends Entity<T>>(this: EntityConstructor<T>, params: EntityParameters, data: RawRowData[]): Promise<T[]>;
    make<T extends Entity<T>>(this: EntityConstructor<T>, params: EntityParameters, data: RawRowData|RawRowData[]): Promise<T|T[]|null>;
    createFromRow<T extends Entity<T>>(this: EntityConstructor<T>, params: EntityParameters, data: RawRowDataWithId): T;

    retrieve<T extends Entity<T>>(this: EntityConstructor<T>, params: EntityParameters, whereClause: Where): Promise<T|null>;
    retrieveAll<T extends Entity<T>>(this: EntityConstructor<T>, params: EntityParameters, whereClause?: Where): Promise<T[]>;
    retrieveOrMake<T extends Entity<T>>(this: EntityConstructor<T>, params: EntityParameters, whereClause: Where, data: RawRowData): Promise<T|null>;

    removeEntries<T extends Entity<T>>(this: EntityConstructor<T>, params: EntityParameters, where?: Where): Promise<void>;
}

interface ChannelEntityInterface {
    name: string;
    channelId: string;
    disabledModules: string[];
}

export interface EntityParameters {
    service?: string;
    channel?: ChannelEntityInterface;
    optionalParam?: string;
}

export default abstract class Entity<T extends Entity<T>> implements Serializable {
    private readonly tableName: string;
    protected schema: TableSchema = null;

    protected constructor(private entityConstructor: EntityConstructor<T>, public id: number, protected params: EntityParameters) {
        this.tableName = getTableName(entityConstructor, Entity.normalizeParameters(params));
        if (this.tableName === null) throw new Error("Model must use the @Table decorator to add the table name formatter.");
        this.schema = new TableSchema(this);
        this.schema.addColumn("id", { datatype: DataTypes.INTEGER, primary: true, increment: true });
    }

    is(entity: Entity<any>): entity is this {
        return entity.id === this.id;
    }

    getSchema(): TableSchema {
        if (this.schema === null) this.schema = new TableSchema(this);

        return this.schema;
    }

    getService(): string {
        return this.params.service;
    }

    async exists(): Promise<boolean> {
        return new Promise((resolve, reject) => {
            Database.get().get(`SELECT COUNT(*) as "count" FROM ${this.tableName} WHERE id = ?`, this.id,(err, row) => {
                if (err)
                    reject(err);
                else {
                    if (row === null) {
                        resolve(false);
                    } else {
                        resolve(row.count);
                    }
                }
            });
        });
    }

    async save(): Promise<void> {
        return new Promise((resolve, reject) => {
            const { keys, columns, prepared } = prepareData(this.getSchema().exportRow());
            Database.get().get(`INSERT OR REPLACE INTO ${this.tableName}(${columns.join(", ")}) VALUES (${keys.join(", ")})`, prepared, err => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }

    async delete(): Promise<void> {
        return this.entityConstructor.removeEntries(this.params, where().eq("id", this.id));
    }

    async load(): Promise<boolean> {
        return new Promise((resolve, reject) => {
            Database.get().get(`SELECT * FROM ${this.tableName} WHERE id = ?`, this.id,(err, row) => {
                if (err)
                    reject(err);
                else {
                    if (row === null) {
                        resolve(false);
                    } else {
                        this.getSchema().importRow(row);
                        resolve(true);
                    }
                }
            });
        });
    }

    async update(obj: { [key: string]: any }): Promise<boolean> {
        let updated = false;
        for (const [key, value] of Object.entries(obj)) {
            if (objectHasProperties(this, key)) {
                this[key] = value;
                updated = true;
            }
        }

        if (updated) {
            if (objectHasProperties(this, "updatedAt")) {
                this["updatedAt"] = moment();
            }

            await this.save();
            return true;
        }

        return false;
    }

    static normalizeParameters(params: EntityParameters): EntityParameters {
        return params;
    }

    static async get<T extends Entity<T>>(this: EntityConstructor<T>, id: number, params: EntityParameters): Promise<T|null> {
        return this.retrieve(params, where().eq("id", id));
    }

    static async getAll<T extends Entity<T>>(this: EntityConstructor<T>, params: EntityParameters): Promise<T[]> {
        return this.retrieveAll(params, undefined);
    }

    static async createTable<T extends Entity<T>>(this: EntityConstructor<T>, params: EntityParameters): Promise<void> {
        const tableName = getTableName(this, this.normalizeParameters(params));
        const columns = formatForCreate(this);
        return new Promise((resolve, reject) => {
            Database.get().exec(`CREATE TABLE IF NOT EXISTS ${tableName}(${columns});`, function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    static async dropTable<T extends Entity<T>>(this: EntityConstructor<T>, params: EntityParameters): Promise<void> {
        const tableName = getTableName(this, this.normalizeParameters(params));
        return new Promise((resolve, reject) => {
            Database.get().exec(`DROP TABLE ${tableName};`, function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    static async make<T extends Entity<T>>(this: EntityConstructor<T>, params: EntityParameters, data: RawRowData): Promise<T|null>;
    static async make<T extends Entity<T>>(this: EntityConstructor<T>, params: EntityParameters, data: RawRowData[]): Promise<T[]>;
    static async make<T extends Entity<T>>(this: EntityConstructor<T>, params: EntityParameters, data: RawRowData|RawRowData[]): Promise<T|T[]|null> {
        return Array.isArray(data) ?
            Entity.makeEntities(this, params, data) :
            Entity.makeEntity(this, params, data);
    }


    static async retrieve<T extends Entity<T>>(this: EntityConstructor<T>, params: EntityParameters, whereClause: Where): Promise<T|null> {
        return this.retrieveAll<T>(params, whereClause).then(models => models.length < 1 ? null : models[0]);
    }

    static async retrieveAll<T extends Entity<T>>(this: EntityConstructor<T>, params: EntityParameters, whereClause?: Where): Promise<T[]> {
        const tableName = getTableName(this, this.normalizeParameters(params));
        if (!whereClause) whereClause = where();
        return new Promise((resolve, reject) => {
            Database.get().all(`SELECT * FROM ${tableName}` + whereClause.toString(), whereClause.getPreparedValues(),(err, rows) => {
                if (err)
                    reject(err);
                else {
                    resolve(rows.map(row => {
                        const model = new this(row.id, params);
                        model.getSchema().importRow(row);
                        return model;
                    }));
                }
            });
        });
    }

    static async retrieveOrMake<T extends Entity<T>>(this: EntityConstructor<T>, params: EntityParameters, whereClause: Where, data: RawRowData): Promise<T|null> {
        return this.retrieve(params, whereClause).then(entity => entity === null ? this.make(params, data) : entity);
    }

    static createFromRow<T extends Entity<T>>(this: EntityConstructor<T>, params: EntityParameters, data: RawRowDataWithId): T {
        const entity = new this(data.id, params);
        entity.getSchema().importRow(data);
        return entity;
    }

    static async removeEntries<T extends Entity<T>>(this: EntityConstructor<T>, params: EntityParameters, whereClause?: Where): Promise<void> {
        const tableName = getTableName(this, this.normalizeParameters(params));
        if (!whereClause) whereClause = where();
        return new Promise((resolve, reject) => {
            Database.get().get(`DELETE FROM ${tableName}${whereClause.toString()};`, whereClause.getPreparedValues(),(err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }

    static async makeEntity<T extends Entity<T>>(entityConstructor: EntityConstructor<T>, params: EntityParameters, data: RawRowData): Promise<T|null> {
        const tableName = getTableName(entityConstructor, this.normalizeParameters(params));
        const { columns, keys, prepared } = prepareData(data);
        return new Promise((resolve, reject) => {
            Database.get().run(`INSERT OR ABORT INTO ${tableName} (${columns.join(", ")}) VALUES (${keys.join(", ")});`, prepared, function (err) {
                if (err) {
                    if ((err as any).errno === 19 && err.message.indexOf("UNIQUE") >= 0) {
                        resolve(null);
                        return;
                    }

                    reject(err);
                } else {
                    const model = new entityConstructor(this.lastID, params);
                    model.load().then(() => resolve(model)).catch(reject);
                }
            });
        });
    }

    static async makeEntities<T extends Entity<T>>(entityConstructor: EntityConstructor<T>, params: EntityParameters, data: RawRowData[]): Promise<T[]> {
        const tableName = getTableName(entityConstructor, this.normalizeParameters(params));
        return new Promise((resolve, reject) => {
            const db = Database.get();
            const ops: Promise<T>[] = [];
            db.serialize(function () {
                db.run("BEGIN TRANSACTION", err => err ? reject(err) : null);
                for (const row of data) {
                    ops.push(new Promise((resolve, reject) => {
                        const { columns, keys, prepared } = prepareData(data[0]);
                        Database.get().run(`INSERT OR IGNORE INTO ${tableName} (${columns.join(", ")}) VALUES (${keys.join(", ")});`, prepared, function (err) {
                            if (err) {
                                reject(err);
                            } else {
                                const model = new entityConstructor(this.lastID, params);
                                model.getSchema().importRow(row);
                                resolve(model);
                            }
                        });
                    }));
                }
                db.run("COMMIT", err => err ? reject(err) : null);
            });
            resolve(Promise.all(ops));
        });
    }

    serialize(): string {
        return JSON.stringify({
            params: this.params,
            rowData: this.getSchema().exportRow()
        });
    }

    static deserialize<T extends Entity<T>>(input: string): T {
        const json = JSON.parse(input);
        const constructor = this as unknown as EntityConstructor<any>;
        const model: T = new constructor(json.rowData.id, json.params);
        model.getSchema().importRow(json.rowData);
        return model;
    }
}