import Entity, {EntityParameters} from "./Entity";
import {Table} from "../Decorators/Table";
import {Column, DataTypes} from "../Decorators/Columns";
import ChannelSpecificEntity from "./ChannelSpecificEntity";

@Table(({ service, channel }) => `${service}_${channel.name}_permissions`)
export default class PermissionEntity extends ChannelSpecificEntity<PermissionEntity> {
    constructor(id: number, params: EntityParameters) {
        super(PermissionEntity, id, params);
    }

    @Column({ datatype: DataTypes.STRING, unique: true })
    public permission: string;

    @Column({ datatype: DataTypes.STRING })
    public role: string;
}