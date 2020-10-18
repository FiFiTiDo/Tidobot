import { Column, Entity, OneToMany } from "typeorm";
import { Channel } from "./Channel";
import CustomBaseEntity from "./CustomBaseEntity";
import { User } from "./User";

@Entity()
export class Service extends CustomBaseEntity {
    @Column({ unique: true })
    name: string;

    @OneToMany(() => User, user => user.service)
    users: User[]

    @OneToMany(() => Channel, channel => channel.service)
    channels: Channel[]
}