import { Column, Entity, JoinTable, ManyToMany, ManyToOne, OneToMany } from "typeorm";
import { PermissionStatus } from "../../Systems/Permissions/Permission";
import { PermissionLike } from "../../Utilities/Interfaces/PermissionLike";
import { Channel } from "./Channel";
import { Chatter } from "./Chatter";
import CustomBaseEntity from "./CustomBaseEntity";
import { GroupPermission } from "./GroupPermission";

@Entity()
export class Group extends CustomBaseEntity {
    @Column()
    name: string;

    @ManyToOne(() => Channel, channel => channel.groups)
    channel: Channel;

    @ManyToMany(() => Chatter, chatter => chatter.groups)
    @JoinTable({
        name: "group_member",
        joinColumns: [{ name: "group", referencedColumnName: "id" }],
        inverseJoinColumns: [{ name: "member", referencedColumnName: "id" }]
    })
    members: Chatter[];

    @OneToMany(() => GroupPermission, groupPermission => groupPermission.group)
    permissions: GroupPermission[]

    checkPermission(permission: PermissionLike): PermissionStatus {
        for (const entity of this.permissions)
            if (entity.permission.token === permission.token)
                return entity.granted ? PermissionStatus.GRANTED : PermissionStatus.DENIED;
        return PermissionStatus.NOT_DEFINED;
    }

    private getMemberIndex(chatter: Chatter): number {
        for (let i = 0; i < this.members.length; i++) {
            const member = this.members[i];
            if (member.id === chatter.id) return i;
        }
        return -1;
    }

    async addMember(chatter: Chatter): Promise<boolean> {
        if (this.getMemberIndex(chatter) !== -1) return false;
        this.members.push(chatter);
        await this.save();
    }

    async removeMember(chatter: Chatter): Promise<boolean> {
        const i = this.getMemberIndex(chatter);
        if (i === -1) return false;
        delete this.members[i];
        await this.save();
    }
}