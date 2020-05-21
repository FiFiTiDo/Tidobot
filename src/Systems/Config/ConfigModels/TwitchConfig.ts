import ConfigModel from "./ConfigModel";
import {ConfigOption} from "../decorators";

export default class TwitchConfig extends ConfigModel {
    constructor() {
        super("twitch");
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

    @ConfigOption
    public api: {
        callbackUrl: string;
        clientId: string;
        clientSecret: string;
    };
}