import { BaseEntity, Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Channel } from "./Channel";
import CustomBaseEntity from "./CustomBaseEntity";

@Entity()
export class News extends CustomBaseEntity {
    @Column()
    itemId: number;

    @Column()
    content: string;

    @ManyToOne(type => Channel, channel => channel.newsItems)
    channel: Channel;
}