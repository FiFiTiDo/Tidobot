import ConfigModel from "./ConfigModel";
import {ConfigOption} from "../decorators";

export default class CacheConfig extends ConfigModel {
    @ConfigOption
    public redis: {
        host: string;
        port: number;
    };
    @ConfigOption
    public length: string;

    constructor() {
        super("cache");
    }
}