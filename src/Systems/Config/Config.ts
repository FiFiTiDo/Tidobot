import Dictionary from "../../Utilities/Structures/Dictionary";
import * as fs from "fs";
import ConfigModel, {ConfigModelConstructor} from "./ConfigModels/ConfigModel";

export default class Config {
    private static instance: Config = null;

    public static getInstance(): Config {
        if (this.instance === null)
            this.instance = new Config();

        return this.instance;
    }

    private models: Map<ConfigModelConstructor<any>, ConfigModel>;

    constructor() {
        this.models = new Map();
    }

    async getConfig<T extends ConfigModel>(constructor: ConfigModelConstructor<T>): Promise<T> {
        if (!this.models.has(constructor)) {
            const model = new constructor();
            await model.load();
            this.models.set(constructor, model);
        }
        return this.models.get(constructor) as T;
    }
}