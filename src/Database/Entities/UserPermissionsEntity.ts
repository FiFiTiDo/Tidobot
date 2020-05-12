import {EntityParameters} from "./Entity";
import {Table} from "../Decorators/Table";
import {Column, DataTypes, Id} from "../Decorators/Columns";
import {Unique} from "../Decorators/Constraints";
import ChannelEntity from "./ChannelEntity";
import {where} from "../Where";
import ChatterEntity from "./ChatterEntity";
import ChannelSpecificEntity from "./ChannelSpecificEntity";

@Id
@Unique("UserPermission", ["permission", "user_id"])
@Table(({service, channel}) => `${service}_${channel.name}_userPermissions`)
export default class UserPermissionsEntity extends ChannelSpecificEntity<UserPermissionsEntity> {
    @Column({datatype: DataTypes.STRING})
    public permission: string;
    @Column({name: "user_id", datatype: DataTypes.INTEGER})
    public userId: number;
    @Column({datatype: DataTypes.BOOLEAN})
    public allowed: boolean;

    constructor(id: number, params: EntityParameters) {
        super(UserPermissionsEntity, id, params);
    }

    public static async update(user: ChatterEntity, permStr: string, allowed: boolean, channel: ChannelEntity): Promise<void> {
        const permission = await UserPermissionsEntity.retrieve({channel}, where().eq("user_id", user.userId).eq("permission", permStr));
        if (permission === null) {
            return UserPermissionsEntity.make({channel}, {
                user_id: user.userId,
                permission: permStr,
                allowed: allowed ? "true" : "false"
            })
                .then(entity => {
                    if (entity === null) throw new Error("Unable to create permission");
                });
        } else {
            permission.allowed = allowed;
            return permission.save();
        }
    }

    public static async clear(user: ChatterEntity): Promise<void> {
        return UserPermissionsEntity.removeEntries({channel: user.getChannel()}, where().eq("user_id", user.userId));
    }

    public static async delete(user: ChatterEntity, permission: string): Promise<void> {
        return UserPermissionsEntity.removeEntries({channel: user.getChannel()}, where().eq("user_id", user.userId).eq("permission", permission));
    }
}