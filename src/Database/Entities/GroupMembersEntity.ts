import Entity from "./Entity";
import {Table} from "../Decorators/Table";
import {Column} from "../Decorators/Columns";
import {DataTypes} from "../Schema";
import {where} from "../BooleanOperations";
import GroupsEntity from "./GroupsEntity";

@Table((service, channel) => `${service}_${channel}_groupMembers`)
export default class GroupMembersEntity extends Entity {
    constructor(id: number, service?: string, channel?: string) {
        super(GroupMembersEntity, id, service, channel);
    }

    @Column({ datatype: DataTypes.INTEGER })
    public user_id: number;

    @Column({ datatype: DataTypes.INTEGER })
    public group_id: number;

    public static async create(user_id: string, group: GroupsEntity) {
        if (await group.isMember(user_id)) return false;
        await GroupMembersEntity.make(group.getService(), group.getChannelName(), { user_id, group_id: group.id });
        return true;
    }

    public static async findByUser(user_id: string, group: GroupsEntity) {
        return Entity.retrieve(GroupMembersEntity, group.getService(), group.getChannelName(), where().eq("user_id", user_id).eq("group_id", group.id));
    }
}