import Dictionary from "./Structures/Dictionary";
import * as fs from "fs";

export default class Config {
    private config: Dictionary;

    constructor(configPath = "../../config") {
        const basePath = __dirname + "/" + configPath;
        this.config = new Dictionary();
        const entries = fs.readdirSync(basePath);
        for (const entry of entries) {
            const json = JSON.parse(fs.readFileSync(basePath + "/" + entry).toString());
            this.config.put(entry.substr(0, entry.length - 5), json);
        }
    }

    get<T>(key: string, def: T = null): T {
        return this.config.getOrDefault(key, def);
    }

    all() {
        return this.config.all();
    }
}