import Dictionary from "./Dictionary";
import * as fs from "fs";

export default class Config {
    private config: Dictionary;

    constructor(configPath: string = '../../config') {
        let basePath = __dirname + '/' + configPath;
        this.config = new Dictionary();
        let entries = fs.readdirSync(basePath);
        for (let entry of entries) {
            let json = JSON.parse(fs.readFileSync(basePath + '/' + entry).toString());
            this.config.put(entry.substr(0, entry.length - 5), json);
        }
    }

    get(key: string, def: any = null): any {
        return this.config.getOrDefault(key, def);
    }

    all() {
        return this.config.all();
    }
}