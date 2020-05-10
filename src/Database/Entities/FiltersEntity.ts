import Entity, {EntityParameters} from "./Entity";
import {Table} from "../Decorators/Table";
import {Column, DataTypes, Id} from "../Decorators/Columns";
import {where} from "../Where";
import ChannelEntity from "./ChannelEntity";

@Id
@Table(({service}) => `${service}_filters`)
export default class FiltersEntity extends Entity<FiltersEntity> {
    constructor(id: number, params: EntityParameters) {
        super(FiltersEntity, id, params);
    }

    @Column({ datatype: DataTypes.STRING })
    public channel_id: string;

    @Column({ datatype: DataTypes.ARRAY })
    public domains: string[];

    @Column({ name: "bad_words", datatype: DataTypes.ARRAY })
    public badWords: string[];

    @Column({ datatype: DataTypes.ARRAY })
    public emotes: string[];

    static getByChannelId(id: string, service: string): Promise<FiltersEntity|null> {
        return FiltersEntity.retrieve({ service }, where().eq("channel_id", id));
    }

    static getByChannel(channel: ChannelEntity): Promise<FiltersEntity|null> {
        return this.getByChannelId(channel.channelId, channel.getService());
    }

    static createForChannel(channel: ChannelEntity): Promise<FiltersEntity|null> {
        return this.make({ service: channel.getService() }, {
            channel_id: channel.channelId,
            domains: "",
            bad_word: "",
            emotes: ""
        });
    }
}