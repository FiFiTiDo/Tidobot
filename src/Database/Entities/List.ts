import _ from "lodash";
import { Column, Entity, ManyToOne, OneToMany } from "typeorm";
import { Channel } from "./Channel";
import CustomBaseEntity from "./CustomBaseEntity";
import { ListItem } from "./ListItem";

@Entity()
export class List extends CustomBaseEntity {
    @Column()
    name: string;

    @Column()
    idCounter: number;

    @OneToMany(() => ListItem, listItem => listItem.list)
    items: ListItem[];

    @ManyToOne(() => Channel, channel => channel.lists)
    channel: Channel;

    getItem(itemId: number): ListItem|null {
        return this.items.find(item => item.itemId === itemId) || null;
    }

    getRandomItem(): ListItem|null {
        return _.sample(this.items) || null;
    }
}