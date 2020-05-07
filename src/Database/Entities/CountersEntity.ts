import Entity, {EntityParameters} from "./Entity";
import {DataTypes} from "../Schema";
import {Table} from "../Decorators/Table";
import {Column} from "../Decorators/Columns";
import ChannelEntity from "./ChannelEntity";
import {where} from "../Where";

@Table(({service, channel}) => `${service}_${channel.name}_news`)
export default class CountersEntity extends Entity<CountersEntity> {
    constructor(id: number, params: EntityParameters) {
        super(CountersEntity, id, params);
    }

    @Column({ datatype: DataTypes.STRING })
    public name: string;

    @Column({ datatype: DataTypes.INTEGER })
    public value: number;

    public static async findByName(name: string, channel: ChannelEntity): Promise<CountersEntity|null> {
        return CountersEntity.retrieve({ channel }, where().eq("name", name));
    }
}