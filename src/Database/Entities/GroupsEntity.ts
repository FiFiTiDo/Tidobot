import Entity from "./Entity";
import {Table} from "../Decorators/Table";
import {Column} from "../Decorators/Columns";
import {DataTypes} from "../Schema";
import GroupPermissionsEntity from "./GroupPermissionsEntity";
import GroupMembersEntity from "./GroupMembersEntity";
import ChatterEntity from "./ChatterEntity";
import {ManyToMany, OneToMany} from "../Decorators/Relationships";
import {where} from "../BooleanOperations";

@Table((service, channel) => `${service}_${channel}_groups`)
export default class GroupsEntity extends Entity {
    constructor(id: number, service?: string, channel?: string) {
        super(GroupsEntity, id, service, channel);
    }

    @Column({ datatype: DataTypes.STRING, unique: true })
    public name: string;

    @ManyToMany(ChatterEntity, GroupMembersEntity, "id", "group_id", "user_id", "user_id")
    async members(): Promise<ChatterEntity[]> { return []; }

    @OneToMany(GroupPermissionsEntity, "id", "group_id")
    async permissions(): Promise<GroupPermissionsEntity[]> { return []; }

    async hasPermission(perm_str: string) {
        for (let permission of await this.permissions())
            if (permission.permission === perm_str)
                return permission.allowed;
        return false;
    }


    async isMember(chatter: string|ChatterEntity) {
        if (chatter instanceof ChatterEntity) chatter = chatter.user_id;
        let members = await this.members();
        for (let member of members)
            if (member.user_id === chatter) return true;
        return false;
    }

    async delete() {
        await super.delete();
        await this.reset();
    }

    async reset() {
        await GroupMembersEntity.removeEntries(this.getService(), this.getChannelName(), where().eq("group_id", this.id));
        await GroupPermissionsEntity.removeEntries(this.getService(), this.getChannelName(), where().eq("group_id", this.id));
    }

    static async findByName(name: string, service: string, channel: string) {
        return Entity.retrieve(GroupsEntity, service, channel, where().eq("name", name));
    }

    static async create(name: string, service: string, channel: string) {
        return GroupsEntity.make<GroupsEntity>(service, channel, { name });
    }
}
