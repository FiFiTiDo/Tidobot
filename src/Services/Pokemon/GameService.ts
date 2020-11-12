import Optional from "../../Utilities/Patterns/Optional";
import {randomChance, randomInt} from "../../Utilities/RandomUtils";
import {ExperienceService} from "./ExperienceService";
import { Service } from "typedi";
import { Channel } from "../../Database/Entities/Channel";
import { Chatter } from "../../Database/Entities/Chatter";
import { Trainer } from "../../Database/Entities/Trainer";
import { NATURES, Pokemon, PokemonTeam } from "../../Database/Entities/Pokemon";
import PokemonModule from "../../Modules/PokemonModule";
import _ from "lodash";

export interface TrainerData {
    chatter: Chatter;
    trainer: Trainer;
    team: Pokemon[];
}

export enum WinState {
    SELF, TARGET, DRAW
}

export interface GameResults {
    leveledUp: string[];
    winner: WinState;
    selfMon: Pokemon;
    targetMon: Pokemon;
}

export interface TrainerStats {
    name: string;
    teamLevel: number;
}

@Service()
export class GameService {
    constructor(
        private experienceService: ExperienceService
    ) {}

    public getTrainerData(chatter: Chatter): Optional<TrainerData> {
        const trainer = chatter.trainer;
        if (trainer === null) return Optional.empty();
        const team = trainer.team;
        return Optional.of({chatter, trainer, team});
    }

    public findMonByName(name: string, team: PokemonTeam): Optional<Pokemon> {
        return Optional.ofUndefable(team.find(pkmn => pkmn.name === name));
    }

    public getRandomMon(team: PokemonTeam): Optional<Pokemon> {
        return team.length < 1 ? Optional.empty() : Optional.of(_.sample(team));
    }

    public async releaseTeam(team: PokemonTeam): Promise<void> {
        await Promise.all(team.map(pkmn => pkmn.remove()));
    }

    public generateRandom(data: TrainerData): Optional<Pokemon> {
        const channel = data.trainer.chatter.channel;
        const current = [data.chatter.user.name, ...data.team.map(pkmn => pkmn.name)];
        const chatters = channel.chatters.filter(chatter => _.includes(current, chatter.user.name));
        const name = _.sample(chatters).user.name || Pokemon.GENERIC_NAME;
        return this.generate(name, data);
    }

    public generate(name: string, {trainer, team}: TrainerData): Optional<Pokemon> {
        if (name !== Pokemon.GENERIC_NAME && team.some(pkmn => pkmn.name === name)) return Optional.empty();

        const channel = trainer.chatter.channel;
        const minLevel = channel.settings.get(PokemonModule.settings.minLevel);
        const maxLevel = channel.settings.get(PokemonModule.settings.maxLevel);
        const level = randomInt(minLevel, maxLevel);

        const pokemon = new Pokemon();
        pokemon.name = name;
        pokemon.level = level;
        pokemon.nature = _.sample(NATURES);
        pokemon.shiny = randomChance(0.05);
        pokemon.rus = randomChance(0.01);

        return Optional.of(pokemon);
    }

    public async getAllTrainerStats(channel: Channel): Promise<TrainerStats[]> {
        const trainers: TrainerStats[] = [];
        for await (const trainerData of channel.trainers) {
            const chatter = trainerData.chatter;
            trainers.push({
                name: chatter.user.name,
                teamLevel: trainerData.team.reduce((prev, pkmn) => prev + pkmn.level, 0)
            });
        }
        return trainers;
    }

    public async attemptFight(self: TrainerData, target: TrainerData): Promise<GameResults> {
        const channel = self.chatter.channel;
        const selfMon = _.sample(self.team);
        const targetMon = _.sample(target.team);

        const win = (Math.random() * 100) - ((targetMon.level - selfMon.level) / 2.1);

        let selfExp = 0;
        let targetExp = 0;
        let winner: WinState;

        const draw_chance = channel.settings.get(PokemonModule.settings.drawChance);
        const MIN_WIN = 50 + draw_chance / 2;
        const MAX_LOSS = 50 - draw_chance / 2;

        if (win > MIN_WIN) { // Win
            self.trainer.won++;
            target.trainer.lost++;
            selfExp = targetMon.level;
            winner = WinState.SELF;
        } else if (win < MAX_LOSS) { // Loss
            self.trainer.lost++;
            target.trainer.won++;
            targetExp = selfMon.level;
            winner = WinState.TARGET;
        } else { // Draw
            self.trainer.draw++;
            target.trainer.draw++;
            selfExp = targetMon.level / 2;
            targetExp = selfMon.level / 2;
            winner = WinState.DRAW;
        }

        const leveledUp = [];
        if (await this.experienceService.addExperience(selfMon, selfExp)) leveledUp.push(selfMon.name);
        if (await this.experienceService.addExperience(targetMon, targetExp)) leveledUp.push(selfMon.name);

        await self.trainer.save();
        await target.trainer.save();

        return {leveledUp, winner, selfMon, targetMon};
    }

    public async attemptCatch(channel: Channel, pokemon: Pokemon): Promise<boolean> {
        const baseChance = channel.settings.get(PokemonModule.settings.baseCatchChance);
        return randomChance(baseChance - (pokemon.level / 1000.0));
    }
}