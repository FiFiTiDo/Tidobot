import {EntityParameters} from "./Entity";
import {Table} from "../Decorators/Table";
import {Column, DataTypes, Id} from "../Decorators/Columns";
import ChannelEntity from "./ChannelEntity";
import ChannelSpecificEntity from "./ChannelSpecificEntity";

@Id
@Table(({ service, channel }) => `${service}_${channel.name}_news`)
export default class NewsEntity extends ChannelSpecificEntity<NewsEntity> {
    constructor(id: number, params: EntityParameters) {
        super(NewsEntity, id, params);
    }

    @Column({ datatype: DataTypes.STRING })
    public value: string;

    public static async create(value: string, channel: ChannelEntity): Promise<NewsEntity|null> {
        return NewsEntity.make({ channel }, { value });
    }
}