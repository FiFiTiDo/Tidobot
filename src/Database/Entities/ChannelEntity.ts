import Entity, {EntityParameters} from "./Entity";
import ChatterEntity from "./ChatterEntity";
import {ChannelSettings} from "./SettingsEntity";
import PermissionEntity from "./PermissionEntity";
import {ImportModel} from "../Decorators/Relationships";
import {Table} from "../Decorators/Table";
import {Column, DataTypes, Id} from "../Decorators/Columns";
import {where} from "../Where";
import {Observable} from "../../Utilities/Patterns/Observable";
import StringLike from "../../Utilities/Interfaces/StringLike";
import ChatterList from "../../Chat/ChatterList";
import Setting, {SettingType, SettingValueType} from "../../Systems/Settings/Setting";
import FiltersEntity from "./FiltersEntity";
import {Logger} from "log4js";
import {getLogger} from "../../Utilities/Logger";
import Optional from "../../Utilities/Patterns/Optional";

@Id
@Table(({service}) => `${service}_channels`)
export default class ChannelEntity extends Entity<ChannelEntity> {
    @Column({name: "channel_id", datatype: DataTypes.STRING, unique: true})
    public channelId: string;
    @Column({datatype: DataTypes.STRING})
    public name: string;
    @Column({name: "disabled_modules"})
    public disabledModules: string[];
    public online: Observable<boolean> = new Observable<boolean>(false);
    public logger: Logger;
    private readonly settingsManager: ChannelSettings;
    private chatterList: ChatterList;

    constructor(id: number, params: EntityParameters) {
        super(ChannelEntity, id, params);

        this.chatterList = new ChatterList();
        this.settingsManager = new ChannelSettings(this);
        this.logger = getLogger("Channel");
        this.logger.addContext("id", id);
    }

    static async findById(id: string, service: string): Promise<ChannelEntity | null> {
        return ChannelEntity.retrieve({service}, where().eq("channel_id", id));
    }

    static async from(id: string, name: string, service: string): Promise<ChannelEntity | null> {
        return this.make({service}, {channel_id: id, name, disabled_modules: ""});
    }

    @ImportModel(ChatterEntity)
    async chatters(): Promise<ChatterEntity[]> {
        return [];
    }

    @ImportModel(PermissionEntity)
    async permissions(): Promise<PermissionEntity[]> {
        return [];
    }

    getSettings(): ChannelSettings {
        return this.settingsManager;
    }

    getSetting<T extends SettingType>(key: string | Setting<T>): Promise<SettingValueType<T> | null> {
        return this.getSettings().get(key);
    }

    setSetting(key: string, value: StringLike): Promise<void> {
        return this.getSettings().set(key, value);
    }

    findChatterById(id: string): Optional<ChatterEntity> {
        return this.chatterList.findById(id);
    }

    findChatterByName(name: string): Optional<ChatterEntity> {
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

    async getFilters(): Promise<FiltersEntity> {
        let filters = await FiltersEntity.getByChannel(this);
        if (filters === null)
            filters = await FiltersEntity.createForChannel(this);
        if (filters === null)
            throw new Error("Unable to retrieve filters.");
        return filters;
    }
}