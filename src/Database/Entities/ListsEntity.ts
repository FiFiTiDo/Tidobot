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
        return Entity.make(ListEntity, this.getService(), this.getChannel(), { value }, this.name);
    }

    public async getItem(id: number) {
        return ListEntity.get(id, this.getService(), this.getChannel(), this.name);
    }

    public async getAllItems() {
        return ListEntity.getAll(this.getService(), this.getChannel(), this.name);
    }

    public async getRandomItem() {
        let items = await this.getAllItems();
        return items[Math.floor(Math.random() * items.length)];
    }

    static async findByName(name: string, service: string, channel: string) {
        return Entity.retrieve(ListsEntity, service, channel, where().eq("name", name));
    }
}