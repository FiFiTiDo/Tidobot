import Entity from "./Entity";
import {Table} from "../Decorators/Table";
import {Column} from "../Decorators/Columns";
import {DataTypes} from "../Schema";

@Table((service, channel) => `${service}_${channel}_permissions`)
export default class PermissionEntity extends Entity {
    constructor(id: number, service?: string, channel?: string) {
        super(PermissionEntity, id, service, channel);
    }

    @Column({ datatype: DataTypes.STRING, unique: true })
    public permission: string;

    @Column({ datatype: DataTypes.STRING })
    public level: string;
}