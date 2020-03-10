import Entity from "./Entity";
import {Table} from "../Decorators/Table";
import {Column} from "../Decorators/Columns";
import {DataTypes} from "../Schema";

@Table(service => `${service}_users`)
export default class UserEntity extends Entity {
    constructor(id: number, service?: string, channel?: string) {
        super(UserEntity, id, service, channel);
    }

    @Column({ datatype: DataTypes.STRING, unique: true })
    public user_id: string;

    @Column({ datatype: DataTypes.STRING })
    public name: string;

    @Column({ datatype: DataTypes.BOOLEAN })
    public ignore: boolean;
}