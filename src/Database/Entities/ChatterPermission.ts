import { Column, Entity, ManyToOne } from "typeorm";
import { Chatter } from "./Chatter";
import CustomBaseEntity from "./CustomBaseEntity";
import { Permission } from "./Permission";

@Entity()
export class ChatterPermission extends CustomBaseEntity {
    @Column()
    granted: boolean;

    @ManyToOne(() => Chatter, chatter => chatter.permissions)
    chatter: Chatter;

    @ManyToOne(() => Permission, permission => permission.chatterPermissions)
    permission: Permission;
}