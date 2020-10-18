import { Column, Entity, OneToMany } from "typeorm";
import CustomBaseEntity from "./CustomBaseEntity";
import { ListItem } from "./ListItem";

@Entity()
export class List extends CustomBaseEntity {
    @Column()
    name: string;

    @Column()
    idCounter: number;

    @OneToMany(type => ListItem, listItem => listItem.list)
    items: ListItem[];
}