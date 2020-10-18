import ConfigModel from "./ConfigModel";
import {ConfigOption} from "../decorators";

export default class GeneralConfig extends ConfigModel {
    @ConfigOption
    public channels: string[];
    @ConfigOption
    public language: string;
    @ConfigOption
    public version: string;
    @ConfigOption
    public service: string;

    constructor() {
        super("general");
    }
}