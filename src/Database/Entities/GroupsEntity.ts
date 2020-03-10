import Entity from "./Entity";
import {Table} from "../Decorators/Table";
import {Column} from "../Decorators/Columns";
import {DataTypes} from "../Schema";
import GroupPermissionsEntity from "./GroupPermissionsEntity";
import GroupMembersEntity from "./GroupMembersEntity";
import ChatterEntity from "./ChatterEntity";
import {ManyToMany, OneToMany} from "../Decorators/Relationships";

@Table((service, channel) => `${service}_${channel}_groups`)
export default class GroupsEntity extends Entity {
    constructor(id: number, service?: string, channel?: string) {
        super(GroupsEntity, id, service, channel);
    }

    @Column({ datatype: DataTypes.STRING, unique: true })
    public name: string;

    @ManyToMany(ChatterEntity, GroupMembersEntity, ["id", "group_id"], ["user_id", "user_id"])
    async members(): Promise<ChatterEntity[]> { return []; }

    @OneToMany(GroupPermissionsEntity, "id", "group_id")
    async permissions(): Promise<GroupPermissionsEntity[]> { return []; }
}