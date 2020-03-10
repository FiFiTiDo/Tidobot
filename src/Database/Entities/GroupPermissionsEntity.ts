import Entity from "./Entity";
import {Table} from "../Decorators/Table";
import {Column} from "../Decorators/Columns";
import {DataTypes} from "../Schema";
import {Unique} from "../Decorators/Constraints";

@Unique("GroupPermission", ["permission", "group_id"])
@Table((service, channel) => `${service}_${channel}_groupPermissions`)
export default class GroupPermissionsEntity extends Entity {
    constructor(id: number, service?: string, channel?: string) {
        super(GroupPermissionsEntity, id, service, channel);
    }

    public permission: string;

    @Column({ datatype: DataTypes.INTEGER })
    public group_id: number;

    @Column({ datatype: DataTypes.BOOLEAN })
    public allowed: boolean;
}