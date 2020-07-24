import ConfigModel from "./ConfigModel";
import {ConfigOption} from "../decorators";

export default class LastFMConfig extends ConfigModel {
    @ConfigOption
    public apiKey: string;
    @ConfigOption
    public secret: string;

    constructor() {
        super("lastfm");
    }
}