import Entity from "./Entity";
import {DataTypes} from "../Schema";
import {Moment} from "moment";
import {Table} from "../Decorators/Table";
import {Column} from "../Decorators/Columns";

@Table((service, channel) => `${service}_${channel}_commands`)
export default class CommandEntity extends Entity {
    constructor(id: number, service?: string, channel?: string) {
        super(CommandEntity, id, service, channel);
    }

    @Column({ datatype: DataTypes.STRING })
    public trigger: string;

    @Column({ datatype: DataTypes.STRING })
    public response: string;

    @Column({ datatype: DataTypes.STRING })
    public condition: string;

    @Column({ datatype: DataTypes.FLOAT })
    public price: number;

    @Column({ datatype: DataTypes.INTEGER })
    public cooldown: number;

    @Column({ datatype: DataTypes.DATE })
    public created_at: Moment;

    @Column({ datatype: DataTypes.DATE })
    public updated_at: Moment;
}