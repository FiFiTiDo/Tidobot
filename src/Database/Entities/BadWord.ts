import { Column, Entity, ManyToOne } from "typeorm";
import { Channel } from "./Channel";
import CustomBaseEntity from "./CustomBaseEntity";

@Entity()
export class BadWord extends CustomBaseEntity {
    @Column()
    value: string;

    @ManyToOne(() => Channel, channel => channel.badWords)
    channel: Channel;
}