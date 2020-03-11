import Entity from "./Entity";
import {Table} from "../Decorators/Table";
import {Column} from "../Decorators/Columns";
import {DataTypes} from "../Schema";
import ListEntity from "./ListEntity";
import {where} from "../BooleanOperations";

@Table((service, channel) => `${service}_${channel}_lists`)
export default class ListsEntity extends Entity {
    constructor(id: number, service: string, channel: string) {
        super(ListsEntity, id, service, channel);
    }

    @Column({ datatype: DataTypes.STRING })
    public name: string;

    public async addItem(value: string) {
        return ListEntity.make<ListEntity>(this.getService(), this.getChannel(), { value }, this.name);
    }

    public async getItem(id: number) {
        return ListEntity.get<ListEntity>(id, this.getService(), this.getChannel(), this.name);
    }

    public async getAllItems() {
        return ListEntity.getAll<ListEntity>(this.getService(), this.getChannel(), this.name);
    }

    public async getRandomItem() {
        let items = await this.getAllItems();
        return items[Math.floor(Math.random() * items.length)];
    }

    public async delete() {
        await super.delete();
        await ListEntity.dropTable(this.getService(), this.getChannel(), name);
    }

    static async findByName(name: string, service: string, channel: string) {
        return Entity.retrieve<ListsEntity>(ListsEntity, service, channel, where().eq("name", name));
    }

    static async create(name: string, service: string, channel: string) {
        let list = await ListsEntity.make(service, channel, { name });
        if (list === null) return null;
        await ListEntity.createTable(service, channel, name);
    }
}
