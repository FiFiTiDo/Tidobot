import Entity, {EntityParameters} from "./Entity";
import {Table} from "../Decorators/Table";
import {Column} from "../Decorators/Columns";
import {DataTypes} from "../Schema";

@Table(({ service, channel, optionalParam }) => `${service}_${channel.name}_list_${optionalParam}`)
export default class ListEntity extends Entity<ListEntity> {
    constructor(id: number, params: EntityParameters) {
        super(ListEntity, id, params);
    }

    @Column({ datatype: DataTypes.STRING })
    public value: string;
}