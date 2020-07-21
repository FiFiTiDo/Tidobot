import PokemonEntity from "../../Database/Entities/PokemonEntity";
import {MapExt} from "../../Utilities/Structures/Map";
import ChannelManager from "../../Chat/ChannelManager";
import TrainerEntity from "../../Database/Entities/TrainerEntity";
import {getLogger} from "../../Utilities/Logger";
import TimerSystem, {TimeUnit} from "../../Systems/Timer/TimerSystem";

const logger = getLogger("Pokemon");

export class ExperienceService {
    private map: MapExt<number, number> = new MapExt<number, number>();

    constructor(channelManager: ChannelManager) {
        TimerSystem.getInstance().startTimer(this.decayAllMonLevels, TimeUnit.Days(1) / 2, channelManager);
    }

    calculateExpForLevel(level: number) {
        const actualLevel = level + 1;
        return actualLevel > 100 ? NaN : Math.pow(actualLevel, 0.75) * 10;
    }

    getExperience(mon: PokemonEntity): number {
        return this.map.getOrSet(mon.id, 0);
    }

    async addExperience(mon: PokemonEntity, amount: number): Promise<number> {
        const startingLevel = mon.level;
        let total = this.getExperience(mon) + amount;
        let currentLevel = mon.level;
        let needed;
        while (total >= (needed = this.calculateExpForLevel(currentLevel))) {
            total -= needed;
            currentLevel--;
        }
        this.map.set(mon.id, total);
        mon.level = currentLevel;
        await mon.save();
        return currentLevel - startingLevel;
    }

    async decayLevel(mon: PokemonEntity): Promise<boolean> {
        if (mon.level > 1)  {
            mon.level--;
            await mon.save();
            return true;
        } else {
            await mon.delete();
            return false;
        }
    }

    async decayAllMonLevels(channelManager: ChannelManager) {
        logger.debug("Decaying pokemon levels");
        for (const channel of channelManager.getAll())
            for await (const trainerData of await TrainerEntity.getAllTrainers(channel))
                await Promise.all(trainerData.team.map(pkmn => this.decayLevel(pkmn)));
    }
}