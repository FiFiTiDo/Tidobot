import { Service } from "typedi";
import { EntityRepository } from "typeorm";
import { Channel } from "../Entities/Channel";
import { Counter } from "../Entities/Counter";
import { ConvertingRepository } from "./ConvertingRepository";

@Service()
@EntityRepository(Counter)
export class CounterRepository extends ConvertingRepository<Counter> {
    static TYPE = "counter";
    convert(raw: string, channel: Channel): Promise<Counter> {
        return this.findOne({ name: raw, channel });
    }

}