import ChatterEntity from "../../Database/Entities/ChatterEntity";
import TrainerEntity from "../../Database/Entities/TrainerEntity";
import PokemonEntity, {NATURES, PokemonStats, PokemonTeam} from "../../Database/Entities/PokemonEntity";
import Optional from "../../Utilities/Patterns/Optional";
import {arrayContains, arrayRand} from "../../Utilities/ArrayUtils";
import {SettingType} from "../../Systems/Settings/Setting";
import {randomChance, randomInt} from "../../Utilities/RandomUtils";
import {ExperienceService} from "./ExperienceService";
import ChannelEntity from "../../Database/Entities/ChannelEntity";

export interface TrainerData {
    chatter: ChatterEntity;
    trainer: TrainerEntity;
    team: PokemonEntity[];
}

export enum WinState {
    SELF, TARGET, DRAW
}

export interface GameResults {
    leveledUp: string[];
    winner: WinState;
    selfMon: PokemonEntity;
    targetMon: PokemonEntity;
}

export interface TrainerStats {
    name: string;
    teamLevel: number;
}

export class GameService {
    constructor(private experienceService: ExperienceService) {}

    public async getTrainerData(chatter: ChatterEntity): Promise<Optional<TrainerData>> {
        const trainer = await TrainerEntity.getByChatter(chatter);
        if (trainer === null) return Optional.empty();
        const team = await trainer.team();
        return Optional.of({chatter, trainer, team});
    }

    public findMonByName(name: string, team: PokemonTeam): Optional<PokemonEntity> {
        return Optional.ofUndefable(team.find(pkmn => pkmn.name === name));
    }

    public getRandomMon(team: PokemonTeam): Optional<PokemonEntity> {
        return team.length < 1 ? Optional.empty() : Optional.of(arrayRand(team));
    }

    public async releaseTeam(team: PokemonTeam): Promise<void> {
        await Promise.all(team.map(pkmn => pkmn.delete()));
    }

    public async generateRandomStats(data: TrainerData): Promise<Optional<PokemonStats>> {
        const channel = data.trainer.getChannel();
        const current = [data.chatter.name, ...data.team.map(pkmn => pkmn.name)];
        const chatters = channel.getChatters().filter(chatter => arrayContains(chatter.name, current));
        const name = arrayRand(chatters).name || PokemonEntity.GENERIC_NAME;
        return this.generateStats(name, data);
    }

    public async generateStats(name: string, {trainer, team}: TrainerData): Promise<Optional<PokemonStats>> {
        if (name !== PokemonEntity.GENERIC_NAME && team.some(pkmn => pkmn.name === name)) return Optional.empty();

        const channel = trainer.getChannel();
        const nature = arrayRand(NATURES);
        const shiny = randomChance(0.05) ? 1 : 0;
        const rus = randomChance(0.01) ? 1 : 0;

        const minLevel = await channel.getSetting<SettingType.INTEGER>("pokemon.level.min");
        const maxLevel = await channel.getSetting<SettingType.INTEGER>("pokemon.level.max");
        const level = randomInt(minLevel, maxLevel);

        return Optional.of({ trainer_id: trainer.id, name, level, nature, shiny, rus });
    }

    public async createMonFromStats(trainer: TrainerEntity, stats: PokemonStats): Promise<PokemonEntity> {
        return PokemonEntity.make({ channel: trainer.getChannel() }, stats);
    }

    public async getAllTrainerStats(channel: ChannelEntity): Promise<TrainerStats[]> {
        const trainers: TrainerStats[] = [];
        for await (const trainerData of await TrainerEntity.getAllTrainers(channel)) {
            const chatter = await trainerData.trainer.chatter();
            trainers.push({ name: chatter.name, teamLevel: trainerData.team.reduce((prev, pkmn) => prev + pkmn.level, 0)});
        }
        return trainers;
    }

    public async attemptFight(self: TrainerData, target: TrainerData): Promise<GameResults> {
        const channel = self.chatter.getChannel();
        const selfMon = arrayRand(self.team);
        const targetMon = arrayRand(target.team);

        const win = (Math.random() * 100) - ((targetMon.level - selfMon.level) / 2.1);

        let selfExp = 0;
        let targetExp = 0;
        let winner: WinState;

        const draw_chance = await channel.getSetting<SettingType.INTEGER>("pokemon.chance.draw");
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

        return { leveledUp, winner, selfMon, targetMon };
    }

    public async attemptCatch(channel: ChannelEntity, stats: PokemonStats): Promise<boolean> {
        const baseChance = await channel.getSetting<SettingType.INTEGER>("pokemon.chance.base-catch");
        return randomChance(baseChance - (stats.level / 1000.0));
    }
}