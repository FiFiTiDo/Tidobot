import { BaseEntity, Column, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Chatter } from "./Chatter";
import CustomBaseEntity from "./CustomBaseEntity";
import { Service } from "./Service";

@Entity()
export class User extends CustomBaseEntity {
    @Column()
    name: string;

    @Column()
    nativeId: string;

    @Column({ default: false })
    ignored: boolean;

    @ManyToOne(type => Service, service => service.users)
    service: Service;

    @OneToMany(type => Chatter, chatter => chatter.user)
    chatters: Chatter[]
}