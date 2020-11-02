import { BaseEntity, Repository } from "typeorm";
import { Channel } from "../Entities/Channel";

export abstract class FilterRepository<T extends BaseEntity> extends Repository<T>  {
    abstract addValue(value: string, channel: Channel): Promise<T|null>;
    abstract removeValue(value: string, channel: Channel): Promise<T|null>;
    abstract removeAll(channel: Channel): Promise<void>
}