import ConfigModel from "./ConfigModel";
import {ConfigOption} from "../decorators";

export default class MixerConfig extends ConfigModel {
    constructor() {
        super("mixer");
    }

    @ConfigOption
    public defaultChannels: string[];

    @ConfigOption
    public identities: {
        [key: string]: {
            username: string;
            password: string;
        }
    };
}