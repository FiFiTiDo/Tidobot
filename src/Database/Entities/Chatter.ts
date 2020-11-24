import { Column, Entity, ManyToMany, ManyToOne, OneToMany, OneToOne, Unique } from "typeorm";
import Permission, { PermissionStatus } from "../../Systems/Permissions/Permission";
import { Channel } from "./Channel";
import { ChatterPermission } from "./ChatterPermission";
import CustomBaseEntity from "./CustomBaseEntity";
import { Group } from "./Group";
import { Trainer } from "./Trainer";
import { User } from "./User";

@Entity()
@Unique("UQ_Chatter_UserId_ChannelId", ["userId", "channelId"])
export class Chatter extends CustomBaseEntity {
    @Column({ default: 0 })
    balance: number;

    @Column({ default: false })
    regular: boolean;

    @Column({ default: false })
    banned: boolean;

    @ManyToOne(() => User, user => user.chatters, { eager: true, nullable: false })
    user: User;

    @ManyToOne(() => Channel, channel => channel.chatters, { nullable: false })
    channel: Channel;

    @OneToMany(() => ChatterPermission, permission => permission.chatter, { eager: true })
    permissions: ChatterPermission[];

    @ManyToMany(() => Group, group => group.members, { eager: true })
    groups: Group[];

    @OneToOne(() => Trainer, trainer => trainer.chatter)
    trainer: Trainer;

    memberOf(group: Group): boolean {
        for (const entity of this.groups)
            if (entity.id === group.id)
                return true;
        return false;
    }

    checkPermission(permission: Permission): PermissionStatus {
        const permissions = this.permissions || [];
        for (const entity of permissions)
            if (entity.permission.token == permission.token)
                return entity.granted ? PermissionStatus.GRANTED : PermissionStatus.DENIED;

        const groups = this.groups || [];
        if (groups.length < 1) return PermissionStatus.NOT_DEFINED;

        let granted = 0;
        for (const group of groups) {
            const status = group.checkPermission(permission);
            if (status === PermissionStatus.DENIED)
                return PermissionStatus.DENIED;
            else if (status === PermissionStatus.GRANTED)
                granted++;
        }
    
        return granted > 0 ? PermissionStatus.GRANTED : PermissionStatus.NOT_DEFINED;
    }

    async deposit(amount: number): Promise<void> {
        this.balance += amount;
        await this.save();   
    }

    async withdraw(amount: number): Promise<void> {
        this.balance -= amount;
        await this.save();   
    }

    async charge(amount: number): Promise<boolean> {
        if (this.balance < amount) return false;
        await this.withdraw(amount);
        return true;
    }

    async resetBalance(): Promise<void> {
        this.balance = 0;
        await this.save();
    }
}