import {EntityParameters} from "./Entity";
import {Table} from "../Decorators/Table";
import {Column, DataTypes, Id} from "../Decorators/Columns";
import ChannelEntity from "./ChannelEntity";
import {where} from "../Where";
import ChannelSpecificEntity from "./ChannelSpecificEntity";

@Id
@Table(({service, channel}) => `${service}_${channel.name}_counters`)
export default class CountersEntity extends ChannelSpecificEntity<CountersEntity> {
    public static readonly TYPE = "counter";
    @Column({datatype: DataTypes.STRING})
    public name: string;
    @Column({datatype: DataTypes.INTEGER})
    public value: number;

    constructor(id: number, params: EntityParameters) {
        super(CountersEntity, id, params);
    }

    public static async findByName(name: string, channel: ChannelEntity): Promise<CountersEntity | null> {
        return CountersEntity.retrieve({channel}, where().eq("name", name));
    }

    public static async convert(raw: string, channel: ChannelEntity): Promise<CountersEntity | null> {
        return this.findByName(raw, channel);
    }
}