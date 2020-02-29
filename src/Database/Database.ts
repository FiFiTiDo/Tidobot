import * as sqlite3 from "sqlite3";
import * as path from "path";
import QueryBuilder from "./QueryBuilder";
import Channel from "../Chat/Channel";
import Table from "./Table";
import Application from "../Application/Application";

export enum DataTypes {
    STRING, INTEGER, FLOAT, BOOLEAN, DATE, ARRAY, ENUM
}

export type ChannelTables =
    "settings"
    | "groups"
    | "users"
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

    constructor(private service: string, private db: sqlite3.Database) {
        this.schema = new Map<string, Table>();
    }

    static async create(service: string) {
        let db = new Database(service, new sqlite3.Database(path.join(process.cwd(), "data", "database.db"), sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE));

        try {
            await db.table("channels").create(table => {
                table.string('channel_id').unique();
                table.string('name');
                table.array('disabled_modules');
                db.schema.set(service + "_channels", table.build("channels"));
            }).ifNotExists().exec();

            await db.table("users").create(table => {
                table.string('user_id').unique();
                table.string('name');
                table.boolean('ignore');
                db.schema.set(service + "_users", table.build("users"));
            }).ifNotExists().exec();
        } catch(e) {
            Application.getLogger().emerg("Unable to create databases for channels and users", { cause: e });
        }

        return db;
    }

    getClient() {
        return this.db;
    }

    table(table: string) {
        return new QueryBuilder(this, `${this.service}_${table}`);
    }

    channelTable(channel: Channel, table: string|ChannelTables) {
        return this.table(`${channel.getName().toLowerCase()}_${table}`);
    }

    async createChannelTables(channel: Channel) {
        let ops = [];
        for (let [name, table] of this.schema.entries()) {
            if (name.startsWith(channel.getName() + "_")) {
                ops.push(this.table(name).create(table1 => {
                    table1.import(table);
                }).ifNotExists().exec().catch(e => {
                    Application.getLogger().error("Unable to create table " + name, { cause: e });
                }));
            }
        }
        await Promise.all(ops);

        let ops2 = [];
        for (let module of Application.getModuleManager().getAll())
            ops2.push(module.onCreateTables(channel));
        return Promise.all(ops);
    }
}