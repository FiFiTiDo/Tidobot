import SettingsSystem from "../Settings/SettingsSystem";
import Setting, {SettingType} from "../Settings/Setting";
import LastFMApi from "./LastFMApi";
import Config from "../Config/Config";
import LastFMConfig from "../Config/ConfigModels/LastFMConfig";
import System from "../System";
import { Service } from "typedi";
import { Channel } from "../../Database/Entities/Channel";

@Service()
export default class LastFMSystem extends System {
    private usernameSetting = new Setting("lastfm.username", "", SettingType.STRING);
    private api: LastFMApi;

    constructor(settings: SettingsSystem, private readonly config: Config) {
        super("LastFM");
        settings.registerSetting(this.usernameSetting);

        this.logger.info("System initialized");
    }

    async onInitialize(): Promise<void> {
        const config = await this.config.getConfig(LastFMConfig);
        this.api = new LastFMApi(config.apiKey, config.secret);
    }

    public getUsername(channel: Channel): string {
        return channel.settings.get(this.usernameSetting);
    }

    public async getLastPlayed(username: string);
    public async getLastPlayed(channel: Channel);
    public async getLastPlayed(target: Channel | string): Promise<any> {
        if (target instanceof Channel)
            return this.getLastPlayed(this.getUsername(target));

        const resp = await this.api.get("user.getRecentTracks", {
            limit: 1,
            user: target
        });
    }

    public async getCurrentPlaying(username: string);
    public async getCurrentPlaying(channel: Channel);
    public async getCurrentPlaying(target: Channel | string): Promise<any> {
        if (target instanceof Channel)
            return this.getCurrentPlaying(this.getUsername(target));


    }
}