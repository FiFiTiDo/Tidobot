import { Column, Entity, ManyToOne, OneToMany } from "typeorm";
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

    @ManyToOne(() => Service, service => service.users, { nullable: false })
    service: Service;

    @OneToMany(() => Chatter, chatter => chatter.user)
    chatters: Chatter[]
}