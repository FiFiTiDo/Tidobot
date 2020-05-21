import ConfigModel from "./ConfigModel";
import {ConfigOption} from "../decorators";

export default class LastFMConfig extends ConfigModel {
    constructor() {
        super("lastfm");
    }

    @ConfigOption
    public apiKey: string;

    @ConfigOption
    public secret: string;
}