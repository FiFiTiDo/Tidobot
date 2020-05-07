import Entity, {EntityParameters} from "./Entity";
import {Table} from "../Decorators/Table";
import {Column} from "../Decorators/Columns";
import {DataTypes} from "../Schema";
import GroupPermissionsEntity from "./GroupPermissionsEntity";
import GroupMembersEntity from "./GroupMembersEntity";
import ChatterEntity from "./ChatterEntity";
import {ManyToMany, OneToMany} from "../Decorators/Relationships";
import {where} from "../Where";
import ChannelEntity from "./ChannelEntity";
import Permission from "../../Systems/Permissions/Permission";

@Table(({ service, channel }) => `${service}_${channel.name}_groups`)
export default class GroupsEntity extends Entity<GroupsEntity> {
    constructor(id: number, params: EntityParameters) {
        super(GroupsEntity, id, params);
    }

    @Column({ datatype: DataTypes.STRING, unique: true })
    public name: string;

    @ManyToMany(ChatterEntity, GroupMembersEntity, "id", "group_id", "user_id", "user_id")
    async members(): Promise<ChatterEntity[]> { return []; }

    @OneToMany(GroupPermissionsEntity, "id", "group_id")
    async permissions(): Promise<GroupPermissionsEntity[]> { return []; }

    async hasPermission(perm: Permission): Promise<boolean> {
        for (const permission of await this.permissions())
            if (permission.permission === perm.getPermission())
                return permission.allowed;
        return false;
    }

    async isMember(chatter: string|ChatterEntity): Promise<boolean> {
        if (chatter instanceof ChatterEntity) chatter = chatter.userId;
        const members = await this.members();
        for (const member of members)
            if (member.userId === chatter) return true;
        return false;
    }

    async delete(): Promise<void> {
        await super.delete();
        await this.reset();
    }

    async reset(): Promise<void> {
        await GroupMembersEntity.removeEntries({ channel: this.getChannel() }, where().eq("group_id", this.id));
        await GroupPermissionsEntity.removeEntries({ channel: this.getChannel() }, where().eq("group_id", this.id));
    }

    static async findByName(name: string, channel: ChannelEntity): Promise<GroupsEntity|null> {
        return GroupsEntity.retrieve({ channel }, where().eq("name", name));
    }

    static async create(name: string, channel: ChannelEntity): Promise<GroupsEntity|null> {
        return GroupsEntity.make<GroupsEntity>({ channel }, { name });
    }
}
