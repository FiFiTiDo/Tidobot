import { Column, Entity, ManyToOne } from "typeorm";
import CustomBaseEntity from "./CustomBaseEntity";
import { List } from "./List";

@Entity()
export class ListItem extends CustomBaseEntity {
    @Column()
    itemId: number;

    @Column()
    content: string;

    @ManyToOne(type => List, list => list.items)
    list: List;
}