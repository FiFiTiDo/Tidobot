import {EntityParameters} from "./Entity";
import {Column, DataTypes, Id} from "../Decorators/Columns";
import {Table} from "../Decorators/Table";
import TrainerEntity from "./TrainerEntity";
import {array_rand} from "../../Utilities/ArrayUtils";
import ChannelSpecificEntity from "./ChannelSpecificEntity";
import {NATURES} from "../../Modules/PokemonModule";
import {randomChance, randomInt} from "../../Utilities/RandomUtils";
import {RawRowData} from "../RowData";

export interface PokemonStats extends RawRowData {
    trainer_id: number;
    name: string;
    level: number;
    shiny: number;
    rus: number;
}

export function formatStats(stats: PokemonStats) {
    return `${stats.shiny === 1 ? "shiny " : ""}${stats.rus === 1 ? "pokerus " : ""}level ${stats.level} ${stats.name}`;
}

const monExperience: { [key: number]: number } = {};

function getExpForLevel(level: number): number {
    return level > 100 ? NaN : Math.pow(level, 0.75) * 10;
}

@Id
@Table(({ service, channel }) => `${service}_${channel.name}_pokemon`)
export default class PokemonEntity extends ChannelSpecificEntity<PokemonEntity> {
    constructor(id: number, params: EntityParameters) {
        super(PokemonEntity, id, params);
    }

    @Column({ name: "trainer_id", datatype: DataTypes.INTEGER })
    public trainerId: number;

    @Column()
    public name: string;

    @Column({ datatype: DataTypes.INTEGER })
    public level: number;

    @Column()
    public nature: string;

    @Column()
    public shiny: boolean;

    @Column()
    public rus: boolean;

    public toString(): string {
        return `${this.name}${this.shiny ? "?" : ""}${this.rus ? "^" : ""}[${this.level}]`;
    }

    public toFullString(): string {
        return `${this.shiny ? "shiny " : ""}${this.rus ? "pokerus " : ""}level ${this.level} ${this.name}`;
    }

    public addExperience(amt: number): number {
        this.setExperience(this.getExperience() + amt);
        const levelStart = this.level;
        let needed;
        while (amt > (needed = getExpForLevel(this.level + 1))) {
            this.setExperience(this.getExperience() - amt);
            this.level++;
        }
        return this.level - levelStart;
    }

    public setExperience(amt: number): void {
        monExperience[this.id] = amt;
    }

    public getExperience(): number {
        if (!Object.prototype.hasOwnProperty.call(monExperience, this.id))
            this.setExperience(0);
        return monExperience[this.id];
    }

    public static async generateStats(trainer: TrainerEntity): Promise<PokemonStats> {
        const channel = trainer.getChannel();
        const current = (await trainer.team()).map(pkmn => pkmn.name);
        const chatters = channel.getChatters().filter(chatter => current.indexOf(chatter.name) < 0);
        const name = array_rand(chatters).name || "MissingNo.";

        const nature = array_rand(NATURES);
        const shiny = randomChance(0.05) ? 1 : 0;
        const rus = randomChance(0.01) ? 1 : 0;

        const minLevel = await channel.getSetting<number>("pokemon.level.min");
        const maxLevel = await channel.getSetting<number>("pokemon.level.max");
        const level = randomInt(minLevel, maxLevel);

        return { trainer_id: trainer.id, name, level, nature, shiny, rus };
    }

    public static fromStats(trainer: TrainerEntity, stats: PokemonStats): Promise<PokemonEntity> {
        return PokemonEntity.make({ channel: trainer.getChannel() }, stats);
    }
}