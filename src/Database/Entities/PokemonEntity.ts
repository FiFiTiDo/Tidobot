import {EntityParameters} from "./Entity";
import {Column, DataTypes, Id} from "../Decorators/Columns";
import {Table} from "../Decorators/Table";
import TrainerEntity from "./TrainerEntity";
import ChannelSpecificEntity from "./ChannelSpecificEntity";
import {RawRowData} from "../RowData";

export interface PokemonStats extends RawRowData {
    trainer_id: number;
    name: string;
    level: number;
    shiny: number;
    rus: number;
}

export const NATURES = [
    'evil', 'mean', 'crazy', 'happy', 'cute',
    'pretty', 'beautiful', 'amazing', 'sleepy',
    'weird', 'funny', 'boring', 'lame', 'silly',
    'neat', 'fun', 'enjoyable', 'pleasing', 'tall',
    'appealing', 'dumb', 'awesome', 'stupid',
    'friendly', 'freaky', 'elegant', 'rich', 'odd',
    'lucky', 'young', 'old', 'unknown', 'confused',
    'forgetful', 'talkative', 'mature', 'immature',
    'strong', 'weak', 'malnourished', 'hungry',
    'dying', 'super', 'naughty', 'short', 'toothless'
];

export function formatStats(stats: PokemonStats) {
    return `${stats.shiny === 1 ? "shiny " : ""}${stats.rus === 1 ? "pokerus " : ""}level ${stats.level} ${stats.name}`;
}

@Id
@Table(({service, channel}) => `${service}_${channel.name}_pokemon`)
export default class PokemonEntity extends ChannelSpecificEntity<PokemonEntity> {
    public static readonly GENERIC_NAME = "MissingNo.";
    @Column({name: "trainer_id", datatype: DataTypes.INTEGER})
    public trainerId: number;
    @Column()
    public name: string;
    @Column({datatype: DataTypes.INTEGER})
    public level: number;
    @Column()
    public nature: string;
    @Column()
    public shiny: boolean;
    @Column()
    public rus: boolean;

    constructor(id: number, params: EntityParameters) {
        super(PokemonEntity, id, params);
    }

    public static fromStats(trainer: TrainerEntity, stats: PokemonStats): Promise<PokemonEntity> {
        return PokemonEntity.make({channel: trainer.getChannel()}, stats);
    }

    public toString(): string {
        return `${this.name}${this.shiny ? "?" : ""}${this.rus ? "^" : ""}[${this.level}]`;
    }

    public toFullString(): string {
        return `${this.shiny ? "shiny " : ""}${this.rus ? "pokerus " : ""}level ${this.level} ${this.name}`;
    }
}

export type PokemonTeam = PokemonEntity[];