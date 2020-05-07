import Entity, {EntityParameters} from "./Entity";
import {Table} from "../Decorators/Table";
import {Column} from "../Decorators/Columns";
import {DataTypes} from "../Schema";
import {where} from "../Where";
import GroupsEntity from "./GroupsEntity";
import ChatterEntity from "./ChatterEntity";
import UserEntity from "./UserEntity";

@Table(({ service, channel }) => `${service}_${channel.name}_groupMembers`)
export default class GroupMembersEntity extends Entity<GroupMembersEntity> {
    constructor(id: number, params: EntityParameters) {
        super(GroupMembersEntity, id, params);
    }

    @Column({ name: "user_id", datatype: DataTypes.INTEGER })
    public userId: number;

    @Column({ name: "group_id", datatype: DataTypes.INTEGER })
    public groupId: number;

    public static async create(userId: string, group: GroupsEntity): Promise<boolean> {
        if (await group.isMember(userId)) return false;
        await GroupMembersEntity.make({ channel: group.getChannel() }, { user_id: userId, group_id: group.id });
        return true;
    }

    public static async findByUser(user: UserEntity|ChatterEntity|string, group: GroupsEntity): Promise<GroupMembersEntity|null> {
        let userId;
        if (user instanceof ChatterEntity || user instanceof UserEntity) {
            userId = user.userId;
        } else {
            userId = user;
        }

        return GroupMembersEntity.retrieve({ channel: group.getChannel() }, where().eq("user_id", userId).eq("group_id", group.id));
    }
}