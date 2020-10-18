import { Column, Entity, ManyToOne } from "typeorm";
import CustomBaseEntity from "./CustomBaseEntity";
import { Group } from "./Group";
import { Permission } from "./Permission";

@Entity()
export class GroupPermission extends CustomBaseEntity {
    @Column()
    granted: boolean;

    @ManyToOne(type => Permission)
    permission: Permission;

    @ManyToOne(type => Group, group => group.permissions)
    group: Group;
}