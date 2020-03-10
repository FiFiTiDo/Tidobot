import Entity from "./Entity";
import {Table} from "../Decorators/Table";
import {Column} from "../Decorators/Columns";
import {DataTypes} from "../Schema";

@Table((service, channel) => `${service}_${channel}_news`)
export default class NewsEntity extends Entity {
    constructor(id: number, service: string, channel: string) {
        super(NewsEntity, id, service, channel);
    }

    @Column({ datatype: DataTypes.STRING })
    public value: string;
}