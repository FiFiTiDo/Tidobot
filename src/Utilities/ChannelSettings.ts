import Channel from "../Chat/Channel";
import Application from "../Application/Application";
import {parseBool, parseStringAs} from "./functions";
import SettingsModule, {convertSetting} from "../Modules/SettingsModule";
import {Where} from "../Database/BooleanOperations";

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
        let where = new Where(null).eq("key", key);
        let setting = await this.channel.query("settings").select().where(where).first();
        if (setting === null) {
            return this.channel.query("settings").insert({ key, value, type: "string", defaultValue: value }).exec();
        } else {
            return this.channel.query("settings").update({ value }).where(where).exec();
        }
    }

    async unset(key: string) {
        let where = new Where(null).eq("key", key);
        let setting = await this.channel.query("settings").select().where(where).first();

        if (setting === null) return false;

        await this.channel.query("settings").update({ value: setting.defaultValue }).where(where).exec();
        return true;
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