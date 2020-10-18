import { BaseEntity, Column, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Role } from "../../Systems/Permissions/Role";
import { Channel } from "./Channel";
import { ChatterPermission } from "./ChatterPermission";
import CustomBaseEntity from "./CustomBaseEntity";
import { GroupPermission } from "./GroupPermission";

@Entity()
export class Permission extends CustomBaseEntity {
    @Column()
    token: string;

    @Column({
        type: "enum",
        enum: Role,
        default: Role.NORMAL
    })
    role: Role

    @Column({
        type: "enum",
        enum: Role,
        default: Role.NORMAL
    })
    defaultRole: Role

    @Column()
    moduleDefined: boolean;

    @ManyToOne(type => Channel, channel => channel.permissions)
    channel: Channel;

    @OneToMany(type => GroupPermission, groupPermission => groupPermission.permission)
    groupPermissions: GroupPermission;

    @OneToMany(type => ChatterPermission, ChatterPermission => ChatterPermission.permission)
    chatterPermissions: ChatterPermission;
}