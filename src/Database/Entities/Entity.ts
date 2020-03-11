import {DataTypes, TableSchema} from "../Schema";
import Application from "../../Application/Application";
import {prepareData, RawRowData} from "../RowData";
import moment from "moment";
import {Where, where} from "../BooleanOperations";
import {formatForCreate, getTableName} from "../Decorators/Table";
import {Serializable} from "../../Utilities/Serializable";

export interface EntityConstructor<T extends Entity>{
    new (id: number, service: string, channel: string, optional_param?: string): T;
}

export default abstract class Entity implements Serializable  {
    private readonly tableName: string;
    protected schema: TableSchema = null;

    protected constructor(private entity_const: EntityConstructor<any>, public id: number, private service: string, private channel: string, private optional_param?: string) {
        this.tableName = getTableName(entity_const, service, channel, optional_param);
        if (this.tableName === null) throw new Error("Model must use the @Table decorator to add the table name formatter.");
        this.schema = new TableSchema(this);
        this.schema.addColumn("id", { datatype: DataTypes.INTEGER, primary: true, increment: true });
    }

    getSchema(): TableSchema {
        if (this.schema === null) this.schema = new TableSchema(this);

        return this.schema;
    }

    getService(): string {
        return this.service;
    }

    getChannel(): string {
        return this.channel;
    }

    async exists(): Promise<boolean> {
        return new Promise((resolve, reject) => {
            Application.getDatabase().getClient().get(`SELECT COUNT(*) as "count" FROM ${this.tableName} WHERE id = ?`, this.id,(err, row) => {
                if (err)
                    reject(err);
                else {
                    if (row === null) {
                        resolve(false);
                    } else {
                        resolve(row.count);
                    }
                }
            })
        });
    }

    async save(): Promise<void> {
        return new Promise((resolve, reject) => {
            let { keys, columns, prepared } = prepareData(this.getSchema().exportRow());
            Application.getDatabase().getClient().get(`INSERT OR REPLACE INTO ${this.tableName}(${columns.join(", ")}) VALUES (${keys.join(", ")})`, prepared, err => {
                if (err)
                    reject(err);
                else
                    resolve();
            })
        });
    }

    async delete(): Promise<void> {
        return new Promise((resolve, reject) => {
            Application.getDatabase().getClient().get(`DELETE FROM ${this.tableName} WHERE id = ?`, this.id,(err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }

    async load(): Promise<boolean> {
        return new Promise((resolve, reject) => {
            Application.getDatabase().getClient().get(`SELECT * FROM ${this.tableName} WHERE id = ?`, this.id,(err, row) => {
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
            })
        });
    }

    async update(obj: { [key: string]: any }): Promise<boolean> {
        let updated = false;
        for (let [key, value] of Object.entries(obj)) {
            if (this.hasOwnProperty(key)) {
                this[key] = value;
                updated = true;
            }
        }

        if (updated) {
            if (this.hasOwnProperty("updated_at")) {
                this["updated_at"] = moment();
            }

            await this.save();
            return true;
        }

        return false;
    }

    static async get<T extends Entity>(id: number, service?: string, channel?: string, optional_param?: string): Promise<T|null> {
        return Entity.retrieve(this as unknown as EntityConstructor<T>, service, channel, where().eq("id", id), optional_param);
    }

    static async getAll<T extends Entity>(service?: string, channel?: string, optional_param?: string): Promise<T[]> {
        return Entity.retrieveAll(this as unknown as EntityConstructor<T>, service, channel, undefined, optional_param);
    }

    static async createTable<T extends Entity>(service?: string, channel?: string, optional_param?: string): Promise<void> {
        return Entity.createTableForEntity(this as unknown as EntityConstructor<T>, service, channel, optional_param);
    }

    static async make<T extends Entity>(service: string, channel: string, data: RawRowData, optional_param?: string) {
        return Entity.makeEntity(this as unknown as EntityConstructor<T>, service, channel, data, optional_param);
    }

    static async retrieve<T extends Entity>(entity_const: EntityConstructor<T>, service: string, channel: string, where: Where<any>, optional_param?: string): Promise<T|null> {
        return Entity.retrieveAll<T>(entity_const, service, channel, where, optional_param).then(models => models.length < 1 ? null : models[0]);
    }

    static async retrieveAll<T extends Entity>(entity_const: EntityConstructor<T>, service: string, channel: string, where_clause?: Where<any>, optional_param?: string): Promise<T[]> {
        let tableName = getTableName(entity_const, service, channel, optional_param);
        if (!where_clause) where_clause = where();
        return new Promise((resolve, reject) => {
            Application.getDatabase().getClient().all(`SELECT * FROM ${tableName}` + where_clause.toString(), where_clause.getPreparedValues(),(err, rows) => {
                if (err)
                    reject(err);
                else {
                    resolve(rows.map(row => {
                        let model = new entity_const(row.id, service, channel);
                        model.getSchema().importRow(row);
                        return model;
                    }));
                }
            })
        });
    }

    static async makeEntity<T extends Entity>(entity_const: EntityConstructor<T>, service: string, channel: string, data: RawRowData, optional_param?: string): Promise<T|null> {
        let tableName = getTableName(entity_const, service, channel, optional_param);
        let { columns, keys, prepared } = prepareData(data);
        return new Promise((resolve, reject) => {
            Application.getDatabase().getClient().run(`INSERT OR ABORT INTO ${tableName} (${columns.join(", ")}) VALUES (${keys.join(", ")})`, prepared, function (err) {
                if (err) {
                    if ((err as any).errno === 19 && err.message.indexOf("UNIQUE") >= 0) {
                        resolve(null);
                        return;
                    }

                    reject(err);
                } else {
                    let model = new entity_const(this.lastID, service, channel);
                    model.load().then(() => resolve(model)).catch(reject);
                }
            })
        });
    }

    static async createTableForEntity<T extends Entity>(entity_const: EntityConstructor<T>, service: string, channel: string, optional_param?: string): Promise<void> {
        let tableName = getTableName(entity_const, service, channel, optional_param);
        let columns = formatForCreate(entity_const);
        return new Promise((resolve, reject) => {
            Application.getDatabase().getClient().exec(`CREATE TABLE IF NOT EXISTS ${tableName}(${columns})`, function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            })
        });
    }

    serialize(): string {
        return JSON.stringify({
            service: this.getService(),
            channel: this.getChannel(),
            optional_param: this.optional_param,
            row_data: this.getSchema().exportRow()
        });
    }

    static deserialize(input: string): Entity {
        let json = JSON.parse(input);
        let constructor = this as unknown as EntityConstructor<any>;
        let model: Entity = new constructor(json.row_data.id, json.service, json.channel, json.optional_param);
        model.getSchema().importRow(json.row_data);
        return model;
    }
}





