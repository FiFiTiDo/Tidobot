import { Column, Entity, JoinColumn, OneToOne } from "typeorm";
import Setting, { SettingType, SettingValueType } from "../../Systems/Settings/Setting";
import { Dot } from "../../Utilities/DotObject";
import { Channel } from "./Channel";
import CustomBaseEntity from "./CustomBaseEntity";

@Entity()
export class ChannelSettings extends CustomBaseEntity {
    @Column()
    json: { [key: string]: any };

    @OneToOne(() => Channel)
    @JoinColumn()
    channel: Channel;

    get<T extends SettingType>(setting: Setting<T>): SettingValueType<T> {
        return Dot.getOrDefault(this.json, setting.key, setting.defaultValue);
    }

    set<T extends SettingType>(setting: Setting<T>, value: any): void {
        Dot.put(this.json, setting.key, value);
    }
}