import ConfigModel from "./ConfigModel";
import {ConfigOption} from "../decorators";

export default class GeneralConfig extends ConfigModel {
    constructor() {
        super("general");
    }

    @ConfigOption
    public language: string;

    @ConfigOption
    public version: string;

    @ConfigOption
    public service: string;
}