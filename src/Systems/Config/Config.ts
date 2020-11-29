import ConfigModel, {ConfigModelConstructor} from "./ConfigModels/ConfigModel";
import System from "../System";
import { Service } from "typedi";

@Service()
export default class Config extends System {
    private static instance: Config = null;
    private models: Map<ConfigModelConstructor<any>, ConfigModel>;

    constructor() {
        super("Config");
        this.models = new Map();
        this.logger.info("System initialized");
    }

    public static getInstance(): Config {
        if (this.instance === null)
            this.instance = new Config();

        return this.instance;
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