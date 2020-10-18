import { BaseEntity, Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Channel } from "./Channel";
import CustomBaseEntity from "./CustomBaseEntity";
import { User } from "./User";

@Entity()
export class Service extends CustomBaseEntity {
    @Column({ unique: true })
    name: string;

    @OneToMany(type => User, user => user.service)
    users: User[]

    @OneToMany(type => Channel, channel => channel.service)
    channels: Channel[]
}