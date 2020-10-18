import { Column, Entity, ManyToOne } from "typeorm";
import { Channel } from "./Channel";
import CustomBaseEntity from "./CustomBaseEntity";

@Entity()
export class DisabledModule extends CustomBaseEntity {
    @Column()
    moduleName: string;

    @ManyToOne(() => Channel, channel => channel.disabledModules)
    channel: Channel;
}