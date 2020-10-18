import { Column, Entity, ManyToMany, ManyToOne, OneToMany } from "typeorm";
import Permission, { PermissionStatus } from "../../Systems/Permissions/Permission";
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
    members: Chatter[];

    @OneToMany(() => GroupPermission, groupPermission => groupPermission.group)
    permissions: GroupPermission[]

    checkPermission(permission: Permission): PermissionStatus {
        for (const entity of this.permissions)
            if (entity.permission.token === permission.token)
                return entity.granted ? PermissionStatus.GRANTED : PermissionStatus.DENIED;
        return PermissionStatus.NOT_DEFINED;
    }
}