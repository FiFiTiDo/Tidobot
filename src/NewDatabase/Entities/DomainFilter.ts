import { Column, Entity, ManyToOne } from "typeorm";
import { Channel } from "./Channel";
import CustomBaseEntity from "./CustomBaseEntity";

@Entity()
export class DomainFilter extends CustomBaseEntity {
    @Column()
    value: string;

    @ManyToOne(type => Channel, channel => channel.domainFilters)
    channel: Channel;
}