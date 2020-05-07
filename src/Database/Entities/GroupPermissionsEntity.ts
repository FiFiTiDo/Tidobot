import Entity, {EntityParameters} from "./Entity";
import {Table} from "../Decorators/Table";
import {Column} from "../Decorators/Columns";
import {DataTypes} from "../Schema";
import {Unique} from "../Decorators/Constraints";
import {where} from "../BooleanOperations";
import GroupsEntity from "./GroupsEntity";

@Unique("GroupPermission", ["permission", "group_id"])
@Table(({ service, channel }) => `${service}_${channel.name}_groupPermissions`)
export default class GroupPermissionsEntity extends Entity<GroupPermissionsEntity> {
    constructor(id: number, params: EntityParameters) {
        super(GroupPermissionsEntity, id, params);
    }

    public permission: string;

    @Column({ name: "group_id", datatype: DataTypes.INTEGER })
    public groupId: number;

    @Column({ datatype: DataTypes.BOOLEAN })
    public allowed: boolean;

    public static async update(group: GroupsEntity, permStr: string, allowed: boolean): Promise<void> {
        const permission = await GroupPermissionsEntity.retrieve({ channel: group.getChannel() }, where().eq("group_id", group.id).eq("permission", permStr));
        if (permission === null) {
            return GroupPermissionsEntity.make({ channel: group.getChannel() }, { group_id: group.id, permission: permStr, allowed: allowed ? "true" : "false" })
                .then(entity => {
                    if (entity === null) throw new Error("Unable to create permission");
                });
        } else {
            permission.allowed = allowed;
            return permission.save();
        }
    }

    public static async clear(group: GroupsEntity): Promise<void> {
        return GroupPermissionsEntity.removeEntries({ channel: group.getChannel() }, where().eq("group_id", group.id));
    }

    public static async delete(group: GroupsEntity, permission: string): Promise<void> {
        return GroupPermissionsEntity.removeEntries({ channel: group.getChannel() }, where().eq("group_id", group.id).eq("permission", permission));
    }
}