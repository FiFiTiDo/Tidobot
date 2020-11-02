import { Column, Entity, ManyToOne } from "typeorm";
import { Channel } from "./Channel";
import CustomBaseEntity from "./CustomBaseEntity";

@Entity()
export class Counter extends CustomBaseEntity {
    @Column()
    name: string;

    @Column()
    value: number;

    @ManyToOne(() => Channel, channel => channel.counters)
    channel: Channel;
}