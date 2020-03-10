import Entity from "./Entity";
import {Table} from "../Decorators/Table";
import {Column} from "../Decorators/Columns";
import {DataTypes} from "../Schema";

@Table((service, channel) => `${service}_${channel}_groupMembers`)
export default class GroupMembersEntity extends Entity {
    constructor(id: number, service?: string, channel?: string) {
        super(GroupMembersEntity, id, service, channel);
    }

    @Column({ datatype: DataTypes.INTEGER })
    public user_id: number;

    @Column({ datatype: DataTypes.INTEGER })
    public group_id: number;
}