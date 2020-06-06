import {EntityParameters} from "./Entity";
import {Table} from "../Decorators/Table";
import {Column, DataTypes, Id} from "../Decorators/Columns";
import ChannelEntity from "./ChannelEntity";
import {where} from "../Where";
import StringLike from "../../Utilities/Interfaces/StringLike";
import SettingsSystem from "../../Systems/Settings/SettingsSystem";
import Cache from "../../Systems/Cache/Cache";
import Setting, {ConvertedSetting, SettingType, SettingValueType} from "../../Systems/Settings/Setting";
import ChannelSpecificEntity from "./ChannelSpecificEntity";

@Id
@Table(({service, channel}) => `${service}_${channel.name}_settings`)
export default class SettingsEntity extends ChannelSpecificEntity<SettingsEntity> {
    @Column({datatype: DataTypes.STRING, unique: true})
    public key: string;
    @Column({datatype: DataTypes.STRING})
    public value: string;
    @Column({datatype: DataTypes.ENUM, enum: SettingType})
    public type: SettingType;
    @Column({name: "default_value", datatype: DataTypes.STRING, null: true})
    public defaultValue: string;

    constructor(id: number, params: EntityParameters) {
        super(SettingsEntity, id, params);
    }

    public static findByKey(key: string, channel: ChannelEntity): Promise<SettingsEntity | null> {
        return SettingsEntity.retrieve({channel}, where().eq("key", key));
    }
}

export class ChannelSettings {
    constructor(private readonly channel: ChannelEntity) {
    }

    async get<T extends SettingType>(key: string|Setting<T>): Promise<SettingValueType<T> | null> {
        const settings = SettingsSystem.getInstance();
        const setting = key instanceof Setting ? key : settings.getSetting(key);
        const defaultValue = setting === null ? null : setting.getDefaultValue();

        let value: string | null;
        try {
            value = await (await Cache.getInstance()).retrieve("channel." + this.channel.channelId + ".setting." + key, 30, async () => {
                const settingsEntity = await SettingsEntity.findByKey(setting.getKey(), this.channel);
                if (settingsEntity === null) settings.getLogger().error("Tried to get non-existent setting: " + key);
                return settingsEntity === null ? defaultValue : setting.value;
            });
        } catch (e) {
            settings.getLogger().error("Unable to retrieve setting", {cause: e});
            value = defaultValue;
        }

        return value !== null ? setting.convert(value) : value;
    }

    async set(key: string, value: StringLike): Promise<void> {
        const setting = await SettingsEntity.findByKey(key, this.channel);
        if (setting === null) {
            return SettingsEntity.make({channel: this.channel}, {
                key,
                value: value.toString(),
                type: "string",
                default_value: value.toString()
            })
                .then(() => {
                    return;
                });
        } else {
            setting.value = value.toString();
            return setting.save();
        }
    }

    async unset(key: string): Promise<boolean> {
        const setting = await SettingsEntity.findByKey(key, this.channel);
        if (setting === null) return false;
        setting.value = setting.defaultValue;
        await setting.save();
        return true;
    }

    async reset(): Promise<void> {
        const settings = SettingsSystem.getInstance();

        await SettingsEntity.removeEntries({channel: this.channel});
        await SettingsEntity.make({channel: this.channel},
            settings.getAll().map(setting => ({
                key: setting.getKey(),
                value: setting.getDefaultValue(),
                type: SettingType[setting.getType()],
                default_value: setting.getDefaultValue()
            }))
        );
    }
}