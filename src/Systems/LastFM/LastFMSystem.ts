import SettingsSystem from "../Settings/SettingsSystem";
import Setting, {SettingType} from "../Settings/Setting";
import LastFMApi from "./LastFMApi";
import ChannelEntity from "../../Database/Entities/ChannelEntity";

export default class LastFMSystem {
    private static instance: LastFMSystem;

    public static getInstance(): LastFMSystem {
        if (this.instance === null)
            this.instance = new LastFMSystem();

        return this.instance;
    }

    private readonly api: LastFMApi;

    constructor() {
        this.api = new LastFMApi(process.env.LAST_FM_API_KEY);

        const settings = SettingsSystem.getInstance();
        settings.registerSetting(new Setting("lastfm.username", "", SettingType.STRING));
    }

    public async getLastPlayed(username: string);
    public async getLastPlayed(channel: ChannelEntity);
    public async getLastPlayed(target: ChannelEntity|string) {
        if (target instanceof ChannelEntity)
            return this.getLastPlayed(await target.getSetting<string>("lastfm.username"));

        const resp = await this.api.get("user.getRecentTracks", {
            limit: 1,
            user: target
        });
    }

    public async getCurrentPlaying(username: string);
    public async getCurrentPlaying(channel: ChannelEntity);
    public async getCurrentPlaying(target: ChannelEntity|string) {
        if (target instanceof ChannelEntity)
            return this.getCurrentPlaying(await target.getSetting<string>("lastfm.username"));


    }
}