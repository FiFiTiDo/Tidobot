import { BaseEntity, Column, Entity, ManyToOne, OneToMany, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { Chatter } from "./Chatter";
import CustomBaseEntity from "./CustomBaseEntity";
import { Pokemon } from "./Pokemon";

@Entity()
export class Trainer extends CustomBaseEntity {
    @Column()
    gamesWon: number;

    @Column()
    gamesLost: number;

    @Column()
    gamesDrawn: number;

    @OneToOne(type => Chatter, chatter => chatter.trainer)
    chatter: Chatter;

    @OneToMany(type => Pokemon, pokemon => pokemon.trainer )
    team: Pokemon[];
}