import Entity, {EntityParameters} from "./Entity";
import {DataTypes} from "../Schema";
import ChatterEntity from "./ChatterEntity";
import CommandEntity from "./CommandEntity";
import SettingsEntity, {ChannelSettings} from "./SettingsEntity";
import GroupsEntity from "./GroupsEntity";
import PermissionEntity from "./PermissionEntity";
import {ImportModel} from "../Decorators/Relationships";
import {Table} from "../Decorators/Table";
import {Column} from "../Decorators/Columns";
import {where} from "../BooleanOperations";
import {Observable} from "../../Utilities/Patterns/Observable";
import StringLike from "../../Utilities/Interfaces/StringLike";
import ChatterList from "../../Chat/ChatterList";
import {ConvertedSetting} from "../../Systems/Settings/Setting";

@Table(({ service }) => `${service}_channels`)
export default class ChannelEntity extends Entity<ChannelEntity> {
    private readonly settingsManager: ChannelSettings;
    private chatterList: ChatterList;

    constructor(id: number, params: EntityParameters) {
        super(ChannelEntity, id, params);

        this.chatterList = new ChatterList();
        this.settingsManager = new ChannelSettings(this);
    }

    @Column({ name: "channel_id", datatype: DataTypes.STRING, unique: true })
    public channelId: string;

    @Column({ datatype: DataTypes.STRING })
    public name: string;

    @Column({ name: "disabled_modules", datatype: DataTypes.ARRAY })
    public disabledModules: string[];

    public online: Observable<boolean> = new Observable<boolean>(false);

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

    getSettings(): ChannelSettings {
        return this.settingsManager;
    }

    getSetting<T extends ConvertedSetting>(key: string): Promise<T|null> {
        return this.getSettings().get<T>(key);
    }

    setSetting(key: string, value: StringLike): Promise<void> {
        return this.getSettings().set(key, value);
    }

    static async findByName(name: string, service: string): Promise<ChannelEntity|null> {
        return ChannelEntity.retrieve({ service }, where().eq("name", name));
    }

    static async from(id: string, name: string, service: string): Promise<ChannelEntity|null> {
        return this.retrieveOrMake({ service }, where().eq("channel_id", id), { channel_id: id, name, disabled_modules: "" });
    }

    findChatterById(id: string) {
        return this.chatterList.findById(id);
    }

    findChatterByName(name: string): ChatterEntity|null {
        return this.chatterList.findByName(name);
    }

    addChatter(chatter: ChatterEntity): void {
        this.chatterList.add(chatter);
    }

    removeChatter(chatter: ChatterEntity): void {
        this.chatterList.remove(chatter);
    }

    getChatters(): ChatterEntity[] {
        return this.chatterList.getAll();
    }
}

export class ChannelStateList<T> {
    private readonly list: { [key: string]: T };
    private readonly defVal: T;

    constructor(defVal: T) {
        this.list = {};
        this.defVal = defVal;
    }

    hasChannel(channel: ChannelEntity): boolean {
        return Object.prototype.hasOwnProperty.call(this.list, channel.channelId);
    }

    getChannel(channel: ChannelEntity): T {
        if (!this.hasChannel(channel))
            this.list[channel.channelId] = this.defVal;

        return this.list[channel.channelId];
    }

    setChannel(channel: ChannelEntity, value: T): void {
        this.list[channel.channelId] = value;
    }

    deleteChannel(channel: ChannelEntity): void {
        delete this.list[channel.channelId];
    }
}