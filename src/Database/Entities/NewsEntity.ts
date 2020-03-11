import Entity from "./Entity";
import {Table} from "../Decorators/Table";
import {Column} from "../Decorators/Columns";
import {DataTypes} from "../Schema";
import Application from "../../Application/Application";
import Channel from "../../Chat/Channel";

@Table((service, channel) => `${service}_${channel}_news`)
export default class NewsEntity extends Entity {
    constructor(id: number, service: string, channel: string) {
        super(NewsEntity, id, service, channel);
    }

    @Column({ datatype: DataTypes.STRING })
    public value: string;

    public static async create(value: string, channel: Channel) {
        return NewsEntity.make(Application.getAdapter().getName(), channel.getName(), { value });
    }
}