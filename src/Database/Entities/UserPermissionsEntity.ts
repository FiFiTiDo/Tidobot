import Entity from "./Entity";
import {Table} from "../Decorators/Table";
import {Column} from "../Decorators/Columns";
import {DataTypes} from "../Schema";
import {Unique} from "../Decorators/Constraints";

@Unique("UserPermission", ["permission", "user_id"])
@Table((service, channel) => `${service}_${channel}_userPermissions`)
export default class UserPermissionsEntity extends Entity {
    constructor(id: number, service?: string, channel?: string) {
        super(UserPermissionsEntity, id, service, channel);
    }

    public permission: string;

    @Column({ datatype: DataTypes.INTEGER })
    public user_id: number;

    @Column({ datatype: DataTypes.BOOLEAN })
    public allowed: boolean;
}