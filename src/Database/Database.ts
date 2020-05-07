import * as sqlite3 from "sqlite3";
import * as path from "path";
import QueryBuilder from "./QueryBuilder";
import Table from "./Table";
import ChannelEntity from "./Entities/ChannelEntity";
import AbstractModule from "../Modules/AbstractModule";
import Logger from "../Utilities/Logger";

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

    channelTable(channel: ChannelEntity, table: string|ChannelTables): QueryBuilder {
        return this.table(`${channel.name.toLowerCase()}_${table}`);
    }

    async createChannelTables(channel: ChannelEntity): Promise<void> {
        const ops = [];
        for (const [name, table] of this.schema.entries()) {
            if (name.startsWith(channel.name + "_")) {
                ops.push(this.table(name).create(table1 => {
                    table1.import(table);
                }).ifNotExists().exec().catch(e => {
                    Logger.get().error("Unable to create table " + name, { cause: e });
                }));
            }
        }
        await Promise.all(ops);

        const ops2 = [];
        for (const module of this.modules)
            ops2.push(module.onCreateTables(channel));
        await Promise.all(ops2);
    }
}