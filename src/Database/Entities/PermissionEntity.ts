import {EntityParameters} from "./Entity";
import {Table} from "../Decorators/Table";
import {Column, DataTypes, Id} from "../Decorators/Columns";
import ChannelSpecificEntity from "./ChannelSpecificEntity";
import {Role} from "../../Systems/Permissions/Role";
import ChannelEntity from "./ChannelEntity";
import {where} from "../Where";

@Id
@Table(({service, channel}) => `${service}_${channel.name}_permissions`)
export default class PermissionEntity extends ChannelSpecificEntity<PermissionEntity> {
    static readonly TYPE = "permission";
    @Column({unique: true})
    public permission: string;
    @Column({datatype: DataTypes.ENUM, enum: Role})
    public role: Role;
    @Column({name: "default_role", datatype: DataTypes.ENUM, enum: Role})
    public defaultRole: Role;
    @Column({name: "module_defined"})
    public moduleDefined: boolean;

    constructor(id: number, params: EntityParameters) {
        super(PermissionEntity, id, params);
    }

    static async convert(raw: string, channel: ChannelEntity): Promise<PermissionEntity | null> {
        return this.retrieve({channel}, where().eq("permission", raw));
    }
}