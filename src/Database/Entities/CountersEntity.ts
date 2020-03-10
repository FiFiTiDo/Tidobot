import Entity from "./Entity";
import {DataTypes} from "../Schema";
import {Table} from "../Decorators/Table";
import {Column} from "../Decorators/Columns";

@Table((service, channel) => `${service}_${channel}_news`)
export default class CountersEntity extends Entity {
    constructor(id: number, service: string, channel: string) {
        super(CountersEntity, id, service, channel);
    }

    @Column({ datatype: DataTypes.STRING })
    public name: string;

    @Column({ datatype: DataTypes.INTEGER })
    public value: number;
}