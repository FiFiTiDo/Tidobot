import { Column, Entity, OneToMany, OneToOne } from "typeorm";
import { Chatter } from "./Chatter";
import CustomBaseEntity from "./CustomBaseEntity";
import { Pokemon } from "./Pokemon";

@Entity()
export class Trainer extends CustomBaseEntity {
    @Column()
    won: number;

    @Column()
    lost: number;

    @Column()
    draw: number;

    @OneToOne(() => Chatter, chatter => chatter.trainer)
    chatter: Chatter;

    @OneToMany(() => Pokemon, pokemon => pokemon.trainer )
    team: Pokemon[];
}