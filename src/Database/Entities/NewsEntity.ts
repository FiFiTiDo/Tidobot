import {EntityParameters} from "./Entity";
import {Table} from "../Decorators/Table";
import {Column, DataTypes, Id} from "../Decorators/Columns";
import ChannelEntity from "./ChannelEntity";
import ChannelSpecificEntity from "./ChannelSpecificEntity";

@Id
@Table(({service, channel}) => `${service}_${channel.name}_news`)
export default class NewsEntity extends ChannelSpecificEntity<NewsEntity> {
    public static readonly TYPE = "news item";
    @Column({datatype: DataTypes.STRING})
    public value: string;

    constructor(id: number, params: EntityParameters) {
        super(NewsEntity, id, params);
    }

    public static async create(value: string, channel: ChannelEntity): Promise<NewsEntity | null> {
        return NewsEntity.make({channel}, {value});
    }

    public static async convert(raw: string, channel: ChannelEntity): Promise<NewsEntity | null> {
        const id = parseInt(raw);
        if (isNaN(id) || id < 0) return null;
        return this.get(id, {channel});
    }
}