import sqlite3 from "sqlite3";
import * as path from "path";
import ChannelEntity from "./Entities/ChannelEntity";
import IgnoredEntity from "./Entities/IgnoredEntity";
import FiltersEntity from "./Entities/FiltersEntity";
import Config from "../Systems/Config/Config";
import GeneralConfig from "../Systems/Config/ConfigModels/GeneralConfig";

export default class Database {
    private static instance: sqlite3.Database = null;

    public static async initialize(): Promise<void> {
        const config = await Config.getInstance().getConfig(GeneralConfig);
        const service = config.service;
        this.instance = new sqlite3.Database(path.join(process.cwd(), "data", "database.db"), sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE);
        try {
            await ChannelEntity.createTable({service});
            await IgnoredEntity.createTable({service});
            await FiltersEntity.createTable({service});
        } catch (e) {
            console.error("Unable to create databases for channels and users");
            console.error("Cause: " + e.message);
            console.error(e.stack);
        }
    }

    public static get(): sqlite3.Database {
        if (this.instance === null)
            throw new Error("Make sure to run Database#initialize before running Database#get");

        return this.instance;
    }
}