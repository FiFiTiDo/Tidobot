import { Service } from "typedi";
import { EntityRepository } from "typeorm";
import { BadWord } from "../Entities/BadWord";
import { Channel } from "../Entities/Channel";
import { FilterRepository } from "./FilterRepository";

@Service()
@EntityRepository(BadWord)
export class BadWordFilterRepository extends FilterRepository<BadWord> {
    async addValue(value: string, channel: Channel): Promise<BadWord|null> {
        return await this.count({ value, channel }) < 1 ? this.create({ value, channel }).save() : null;
    }

    async removeValue(value: string, channel: Channel): Promise<BadWord|null> {
        return this.remove(await this.findOne({ value, channel }));
    }

    async removeAll(channel: Channel): Promise<void> {
        await this.remove(channel.badWords);
    }
}