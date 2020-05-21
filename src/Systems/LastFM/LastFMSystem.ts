import SettingsSystem from "../Settings/SettingsSystem";
import Setting, {SettingType} from "../Settings/Setting";
import LastFMApi from "./LastFMApi";
import ChannelEntity from "../../Database/Entities/ChannelEntity";
import Config from "../Config/Config";
import LastFMConfig from "../Config/ConfigModels/LastFMConfig";

export default class LastFMSystem {
    private static instance: LastFMSystem;

    public static async getInstance(): Promise<LastFMSystem> {
        if (this.instance === null) {
            const config = await Config.getInstance().getConfig(LastFMConfig);
            this.instance = new LastFMSystem(new LastFMApi(config.apiKey, config.secret));
        }

        return this.instance;
    }

    constructor(private readonly api: LastFMApi) {
        const settings = SettingsSystem.getInstance();
        settings.registerSetting(new Setting("lastfm.username", "", SettingType.STRING));
    }

    public getUsername(channel: ChannelEntity): Promise<string> {
        return channel.getSetting<string>("lastfm.username");
    }

    public async getLastPlayed(username: string);
    public async getLastPlayed(channel: ChannelEntity);
    public async getLastPlayed(target: ChannelEntity|string) {
        if (target instanceof ChannelEntity)
            return this.getLastPlayed(await this.getUsername(target));

        const resp = await this.api.get("user.getRecentTracks", {
            limit: 1,
            user: target
        });
    }

    public async getCurrentPlaying(username: string);
    public async getCurrentPlaying(channel: ChannelEntity);
    public async getCurrentPlaying(target: ChannelEntity|string) {
        if (target instanceof ChannelEntity)
            return this.getCurrentPlaying(await this.getUsername(target));


    }
}