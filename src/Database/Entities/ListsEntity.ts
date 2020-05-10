import {EntityParameters} from "./Entity";
import {Table} from "../Decorators/Table";
import {Column, DataTypes, Id} from "../Decorators/Columns";
import ListEntity from "./ListEntity";
import {where} from "../Where";
import ChannelEntity from "./ChannelEntity";
import ChannelSpecificEntity from "./ChannelSpecificEntity";

@Id
@Table(({ service, channel }) => `${service}_${channel.name}_lists`)
export default class ListsEntity extends ChannelSpecificEntity<ListsEntity> {
    constructor(id: number, params: EntityParameters) {
        super(ListsEntity, id, params);
    }

    @Column({ datatype: DataTypes.STRING })
    public name: string;

    public async addItem(value: string): Promise<ListEntity|null> {
        return ListEntity.make<ListEntity>({ channel: this.getChannel(), optionalParam: this.name }, { value });
    }

    public async getItem(id: number): Promise<ListEntity|null> {
        return ListEntity.retrieve({ channel: this.getChannel(), optionalParam: this.name }, where().eq("id", id));
    }

    public async getAllItems(): Promise<ListEntity[]> {
        return ListEntity.getAll<ListEntity>({ channel: this.getChannel(), optionalParam: this.name });
    }

    public async getRandomItem(): Promise<ListEntity|null> {
        const items = await this.getAllItems();
        if (items.length < 1) return null;
        return items[Math.floor(Math.random() * items.length)];
    }

    public async delete(): Promise<void> {
        await super.delete();
        await ListEntity.dropTable({ channel: this.getChannel(), optionalParam: this.name });
    }

    static async findByName(name: string, channel: ChannelEntity): Promise<ListsEntity|null> {
        return ListsEntity.retrieve({ channel }, where().eq("name", name));
    }

    static async create(name: string, channel: ChannelEntity): Promise<ListsEntity|null> {
        const list = await ListsEntity.make<ListsEntity>({ channel }, { name });
        if (list === null) return null;
        await ListEntity.createTable({ channel, optionalParam: name });
        return list;
    }
}
