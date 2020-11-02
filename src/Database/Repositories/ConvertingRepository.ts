import { BaseEntity, Repository } from "typeorm";
import { Channel } from "../Entities/Channel";

export interface ConvertingRepositoryConstructor<T extends BaseEntity> {
    TYPE: string;
    new(...args: any[]): ConvertingRepository<T>;
}

export abstract class ConvertingRepository<T extends BaseEntity> extends Repository<T> {
    abstract convert(raw: string, channel: Channel): Promise<T>;
}