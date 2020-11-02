import { Column, Entity, ManyToMany, ManyToOne, OneToMany, OneToOne } from "typeorm";
import Permission, { PermissionStatus } from "../../Systems/Permissions/Permission";
import { Channel } from "./Channel";
import { ChatterPermission } from "./ChatterPermission";
import CustomBaseEntity from "./CustomBaseEntity";
import { Group } from "./Group";
import { Trainer } from "./Trainer";
import { User } from "./User";

@Entity()
export class Chatter extends CustomBaseEntity {
    @Column({ default: 0 })
    balance: number;

    @Column({ default: false })
    regular: boolean;

    @Column({ default: false })
    banned: boolean;

    @ManyToOne(() => User, user => user.chatters)
    user: User;

    @ManyToOne(() => Channel, channel => channel.chatters)
    channel: Channel;

    @OneToMany(() => ChatterPermission, permission => permission.chatter)
    permissions: ChatterPermission[];

    @ManyToMany(() => Group, group => group.members)
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
        for (const entity of this.permissions)
            if (entity.permission.token == permission.token)
                return entity.granted ? PermissionStatus.GRANTED : PermissionStatus.DENIED;

        if (this.groups.length < 1) return PermissionStatus.NOT_DEFINED;

        let granted = 0;
        for (const group of this.groups) {
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