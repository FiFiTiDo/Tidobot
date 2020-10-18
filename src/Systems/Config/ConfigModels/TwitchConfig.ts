import ConfigModel from "./ConfigModel";
import {ConfigOption} from "../decorators";

export default class TwitchConfig extends ConfigModel {
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

    constructor() {
        super("twitch");
    }
}