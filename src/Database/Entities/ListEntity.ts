import Entity from "./Entity";
import {Table} from "../Decorators/Table";
import {Column} from "../Decorators/Columns";
import {DataTypes} from "../Schema";

@Table((service, channel, optional_param) => `${service}_${channel}_list_${optional_param}`)
export default class ListEntity extends Entity {
    constructor(id: number, service: string, channel: string, optional_param: string) {
        super(ListEntity, id, service, channel, optional_param);
    }

    @Column({ datatype: DataTypes.STRING })
    public value: string;
}