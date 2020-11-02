import {MapExt} from "../../Utilities/Structures/Map";
import ChannelManager from "../../Chat/ChannelManager";
import {getLogger} from "../../Utilities/Logger";
import TimerSystem, {TimeUnit} from "../../Systems/Timer/TimerSystem";
import { Service } from "typedi";
import { Pokemon } from "../../Database/Entities/Pokemon";

const logger = getLogger("Pokemon");

@Service()
export class ExperienceService {
    private map: MapExt<number, number> = new MapExt<number, number>();

    constructor(channelManager: ChannelManager, timerSystem: TimerSystem) {
        timerSystem.startTimer(this.decayAllMonLevels, TimeUnit.Days(1) / 2, channelManager);
    }

    calculateExpForLevel(level: number): number {
        const actualLevel = level + 1;
        return actualLevel > 100 ? NaN : Math.pow(actualLevel, 0.75) * 10;
    }

    getExperience(mon: Pokemon): number {
        return this.map.getOrSet(mon.id, 0);
    }

    async addExperience(mon: Pokemon, amount: number): Promise<number> {
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

    async decayLevel(mon: Pokemon): Promise<boolean> {
        if (mon.level > 1) {
            mon.level--;
            await mon.save();
            return true;
        } else {
            await mon.remove();
            return false;
        }
    }

    async decayAllMonLevels(channelManager: ChannelManager): Promise<void> {
        logger.debug("Decaying pokemon levels");
        for (const channel of await channelManager.getAllActive())
            for await (const trainerData of channel.trainers)
                await Promise.all(trainerData.team.map(pkmn => this.decayLevel(pkmn)));
    }
}