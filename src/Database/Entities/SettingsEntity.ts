import Entity from "./Entity";
import {Table} from "../Decorators/Table";
import {Column} from "../Decorators/Columns";
import {DataTypes} from "../Schema";

@Table((service, channel) => `${service}_${channel}_settings`)
export default class SettingsEntity extends Entity {
    constructor(id: number, service?: string, channel?: string) {
        super(SettingsEntity, id, service, channel);
    }

    @Column({ datatype: DataTypes.STRING, unique: true })
    public key: string;

    @Column({ datatype: DataTypes.STRING })
    public value: string;

    @Column({ datatype: DataTypes.ENUM, enum: ["string", "integer", "float", "boolean"] })
    public type: string;

    @Column({ name: "default_value", datatype: DataTypes.STRING, null: true })
    public defaultValue: string;
}