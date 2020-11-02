import { Service } from "typedi";
import { EntityRepository, Repository } from "typeorm";
import { InjectRepository } from "typeorm-typedi-extensions";
import { Channel } from "../Entities/Channel";
import { List } from "../Entities/List";
import { ConvertingRepository } from "./ConvertingRepository";

@Service()
@EntityRepository(List)
export class ListRepository extends ConvertingRepository<List> {
    static TYPE = "list";

    convert(raw: string, channel: Channel): Promise<List> {
        return this.findOne({ name: raw, channel });
    }
}