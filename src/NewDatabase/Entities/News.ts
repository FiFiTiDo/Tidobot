import { Column, Entity, ManyToOne } from "typeorm";
import { Channel } from "./Channel";
import CustomBaseEntity from "./CustomBaseEntity";

@Entity()
export class News extends CustomBaseEntity {
    @Column()
    itemId: number;

    @Column()
    content: string;

    @ManyToOne(() => Channel, channel => channel.newsItems)
    channel: Channel;
}