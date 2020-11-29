import { Service } from "typedi";
import { EntityRepository, Repository } from "typeorm";
import { List } from "../Entities/List";
import { ListItem } from "../Entities/ListItem";

@Service()
@EntityRepository(ListItem)
export class ListItemRepository extends Repository<ListItem> {
    async add(list: List, content: string): Promise<ListItem> {
        const itemId = list.idCounter++;
        await list.save();
        return this.create({ itemId, content, list }).save();
    }
}