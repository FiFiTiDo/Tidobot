import {EntityParameters} from "./Entity";
import {Table} from "../Decorators/Table";
import {Column, DataTypes, Id} from "../Decorators/Columns";
import ChannelSpecificEntity from "./ChannelSpecificEntity";

@Id
@Table(({service, channel, optionalParam}) => `${service}_${channel.name}_list_${optionalParam}`)
export default class ListEntity extends ChannelSpecificEntity<ListEntity> {
    @Column({datatype: DataTypes.STRING})
    public value: string;

    constructor(id: number, params: EntityParameters) {
        super(ListEntity, id, params);
    }
}