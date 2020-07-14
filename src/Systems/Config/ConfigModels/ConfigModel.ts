import {getMetadata} from "../../../Utilities/DecoratorUtils";
import {CONFIG_OPTIONS_KEY} from "../decorators";
import * as path from "path";
import * as fs from "fs";
import {promisify} from "util";

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

const CONFIG_PATH = path.resolve(process.cwd(), "config");

export default abstract class ConfigModel {
    protected constructor(private filename: string) {
    }

    async load(): Promise<void> {
        const contents = await readFile(path.join(CONFIG_PATH, this.filename + ".json"));
        const input = JSON.parse(contents.toString());
        for (const [key, value] of Object.entries(input))
            this[key] = value;
    }

    async save(): Promise<void> {
        const output = {};
        const options = getMetadata<string[]>(CONFIG_OPTIONS_KEY, this.constructor);
        for (const option of options)
            output[option] = this[option];
        return writeFile(
            path.join(CONFIG_PATH, this.filename + ".json"),
            JSON.stringify(output, null, 2)
        );
    }
}

export interface ConfigModelConstructor<T extends ConfigModel> {
    new(): T;
}