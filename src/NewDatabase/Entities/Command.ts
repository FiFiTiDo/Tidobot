import { Column, CreateDateColumn, Entity, ManyToOne, UpdateDateColumn } from "typeorm";
import { Channel } from "./Channel";
import CustomBaseEntity from "./CustomBaseEntity";

@Entity()
export class Command extends CustomBaseEntity {
    @Column()
    commandId: number;

    @Column()
    trigger: string;

    @Column()
    response: string;

    @Column()
    condition: string;

    @Column()
    price: number;

    @Column()
    userCooldown: number;

    @Column()
    globalCooldown: number;

    @Column()
    enabled: number;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @ManyToOne(() => Channel, channel => channel.commands)
    channel: Channel;
}