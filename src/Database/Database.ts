import * as sqlite3 from "sqlite3";
import * as path from "path";
import QueryBuilder from "./QueryBuilder";
import Table from "./Table";
import AbstractModule from "../Modules/AbstractModule";

export enum DataTypes {
    STRING, INTEGER, FLOAT, BOOLEAN, DATE, ARRAY, ENUM
}

export type ChannelTables =
    "settings"
    | "groups"
    | "chatters"
    | "groupMembers"
    | "commands"
    | "permissions"
    | "userPermissions"
    | "groupPermissions"
    | "lists"
    | "counters"
    | "news";

export default class Database {
    public readonly schema: Map<string, Table>;

    constructor(private service: string, private db: sqlite3.Database, private modules: AbstractModule[]) {
        this.schema = new Map<string, Table>();
    }

    static async create(service: string, modules: AbstractModule[]): Promise<Database> {
        const db = new Database(service, new sqlite3.Database(path.join(process.cwd(), "data", "database.db"), sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE), modules);

        try {
            await db.table("channels").create(table => {
                table.string("channel_id").unique();
                table.string("name");
                table.array("disabled_modules");
                db.schema.set(service + "_channels", table.build("channels"));
            }).ifNotExists().exec();

            await db.table("users").create(table => {
                table.string("user_id").unique();
                table.string("name");
                table.boolean("ignore");
                db.schema.set(service + "_users", table.build("users"));
            }).ifNotExists().exec();
        } catch(e) {
            console.error("Unable to create databases for channels and users");
            console.error("Cause: " + e.message);
            console.error(e.stack);
        }

        return db;
    }

    getClient(): sqlite3.Database {
        return this.db;
    }

    table(table: string): QueryBuilder {
        return new QueryBuilder(this, `${this.service}_${table}`);
    }
}