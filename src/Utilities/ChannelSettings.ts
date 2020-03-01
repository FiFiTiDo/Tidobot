import Channel from "../Chat/Channel";
import Application from "../Application/Application";
import {parseBool, parseStringAs} from "./functions";
import SettingsModule, {convertSetting} from "../Modules/SettingsModule";

interface StringLike {
    toString(): string;
}

export default class ChannelSettings {
    constructor(private readonly channel: Channel) {
    }

    private static getAllSettingData() {
        return Application.getModuleManager().getModule(SettingsModule).getAllSettings();
    }

    private static getSettingData(key: string) {
        let settings = this.getAllSettingData();
        return settings.hasOwnProperty(key) ? settings[key] : null;
    }

    async get(key: string) {
        let setting = ChannelSettings.getSettingData(key);
        let defaultValue = setting === null ? null : setting.value;

        let value;
        try {
            value = await Application.getCache().retrieve("channel." + this.channel.getId() + ".setting." + key, 30, async () => {
                let row = await this.channel.query("settings").select("value").where().eq("key", key).done().first();
                if (row === null) Application.getLogger().error("Tried to get non-existent setting: " + key);
                return row === null ? defaultValue : row.value;
            });
        } catch (e) {
            Application.getLogger().error("Unable to retrieve setting", {cause: e});
            value = defaultValue;
        }

        return setting !== null ? convertSetting(value, setting.type) : value;
    }

    async set(key: string, value: StringLike) {
        return this.channel.query("settings").insert({ key, value }).or("REPLACE").exec();
    }

    async unset(key: string) {
        let setting = ChannelSettings.getSettingData(key);
        return setting === null ?
            this.channel.query("settings").delete().where().eq("key", key).done().exec() :
            this.channel.query("settings").update({ value: setting.value }).where().eq("key", key).done().exec();
    }

    async reset() {
        await this.channel.query("settings").delete().exec();
        await this.channel.query("settings").insert(
            Object.entries(ChannelSettings.getAllSettingData()).map(([key, { value, type }]) => {
                return {key, value, type, defaultValue: value};
            })
        ).exec();
    }
}