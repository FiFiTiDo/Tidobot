import Entity, {EntityParameters} from "./Entity";
import {Table} from "../Decorators/Table";
import {Column} from "../Decorators/Columns";
import {DataTypes} from "../Schema";
import ChannelEntity from "./ChannelEntity";

@Table(({ service, channel }) => `${service}_${channel.name}_news`)
export default class NewsEntity extends Entity<NewsEntity> {
    constructor(id: number, params: EntityParameters) {
        super(NewsEntity, id, params);
    }

    @Column({ datatype: DataTypes.STRING })
    public value: string;

    public static async create(value: string, channel: ChannelEntity): Promise<NewsEntity|null> {
        return NewsEntity.make({ channel }, { value });
    }
}