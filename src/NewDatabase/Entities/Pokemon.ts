import { Column, Entity, ManyToOne } from "typeorm";
import CustomBaseEntity from "./CustomBaseEntity";
import { Trainer } from "./Trainer";

export interface PokemonStats {
    name: string;
    level: number;
    shiny: boolean;
    rus: boolean;
}

export const NATURES = [
    "evil", "mean", "crazy", "happy", "cute",
    "pretty", "beautiful", "amazing", "sleepy",
    "weird", "funny", "boring", "lame", "silly",
    "neat", "fun", "enjoyable", "pleasing", "tall",
    "appealing", "dumb", "awesome", "stupid",
    "friendly", "freaky", "elegant", "rich", "odd",
    "lucky", "young", "old", "unknown", "confused",
    "forgetful", "talkative", "mature", "immature",
    "strong", "weak", "malnourished", "hungry",
    "dying", "super", "naughty", "short", "toothless"
];

@Entity()
export class Pokemon extends CustomBaseEntity {
    public static readonly GENERIC_NAME = "MissingNo.";

    @Column()
    name: string;

    @Column()
    level: number;

    @Column()
    nature: string;

    @Column()
    shiny: boolean;

    @Column()
    rus: boolean;

    @ManyToOne(() => Trainer, trainer => trainer.team)
    trainer: Trainer;

    public toString(): string {
        return `${this.name}${this.shiny ? "?" : ""}${this.rus ? "^" : ""}[${this.level}]`;
    }

    public toFullString(): string {
        return `${this.shiny ? "shiny " : ""}${this.rus ? "pokerus " : ""}level ${this.level} ${this.name}`;
    }
}

export type PokemonTeam = Pokemon[];