import { Service } from "typedi";
import { EntityRepository } from "typeorm";
import { Channel } from "../Entities/Channel";
import { DomainFilter } from "../Entities/DomainFilter";
import { FilterRepository } from "./FilterRepository";

@Service()
@EntityRepository(DomainFilter)
export class DomainFilterRepository extends FilterRepository<DomainFilter> {
    async addValue(value: string, channel: Channel): Promise<DomainFilter|null> {
        return await this.count({ value, channel }) < 1 ? this.create({ value, channel }).save() : null;
    }

    async removeValue(value: string, channel: Channel): Promise<DomainFilter|null> {
        return this.remove(await this.findOne({ value, channel }));
    }

    async removeAll(channel: Channel): Promise<void> {
        await this.remove(channel.domainFilters);
    }
}