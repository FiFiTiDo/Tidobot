import Entity from "./Entity";
import {DataTypes} from "../Schema";
import {Table} from "../Decorators/Table";
import {Column} from "../Decorators/Columns";
import {where} from "../BooleanOperations";

@Table(service => `${service}_filters`)
export default class FiltersEntity extends Entity {
    constructor(id: number, service?: string, channel?: string) {
        super(FiltersEntity, id, service, channel);
    }

    @Column({ datatype: DataTypes.STRING })
    public channel_id: string;

    @Column({ datatype: DataTypes.ARRAY })
    public domains: string[];

    @Column({ datatype: DataTypes.ARRAY })
    public bad_words: string[];

    @Column({ datatype: DataTypes.ARRAY })
    public emotes: string[];

    static getByChannelId(id: string, service: string) {
        return Entity.retrieve(FiltersEntity, service, null, where().eq("channel_id", id));
    }
}