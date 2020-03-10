import Entity from "./Entity";
import {DataTypes} from "../Schema";
import {Table} from "../Decorators/Table";
import {Column} from "../Decorators/Columns";

@Table((service, channel) => `${service}_${channel}_chatters`)
export default class ChatterEntity extends Entity {
    constructor(id: number, service?: string, channel?: string) {
        super(ChatterEntity, id, service, channel);
    }

    @Column({ datatype: DataTypes.STRING, unique: true })
    public user_id: string;

    @Column({ datatype: DataTypes.STRING })
    public name: string;

    @Column({ datatype: DataTypes.INTEGER })
    public balance: number;

    @Column({ datatype: DataTypes.BOOLEAN })
    public banned: boolean;

    @Column({ datatype: DataTypes.BOOLEAN })
    public regular: boolean;
}