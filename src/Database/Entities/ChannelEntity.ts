import Entity from "./Entity";
import {DataTypes} from "../Schema";
import ChatterEntity from "./ChatterEntity";
import CommandEntity from "./CommandEntity";
import SettingsEntity from "./SettingsEntity";
import GroupsEntity from "./GroupsEntity";
import PermissionEntity from "./PermissionEntity";
import {ImportModel} from "../Decorators/Relationships";
import {Table} from "../Decorators/Table";
import {Column} from "../Decorators/Columns";

@Table(service => `${service}_channels`)
export default class ChannelEntity extends Entity {
    constructor(id: number, service?: string, channel?: string) {
        super(ChannelEntity, id, service, channel);
    }

    @Column({ datatype: DataTypes.STRING, unique: true })
    public channel_id: string;

    @Column({ datatype: DataTypes.STRING })
    public name: string;

    @Column({ datatype: DataTypes.ARRAY })
    public disabled_modules: string[];

    @ImportModel(ChatterEntity)
    async chatters(): Promise<ChatterEntity[]> { return []; }

    @ImportModel(CommandEntity)
    async commands(): Promise<CommandEntity[]> { return []; }

    @ImportModel(SettingsEntity)
    async settings(): Promise<SettingsEntity[]> { return []; }

    @ImportModel(GroupsEntity)
    async groups(): Promise<GroupsEntity[]> { return []; }

    @ImportModel(PermissionEntity)
    async permissions(): Promise<PermissionEntity[]> { return []; }
}