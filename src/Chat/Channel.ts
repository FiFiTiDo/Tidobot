import Application from "../Application/Application";
import {Serializable} from "../Utilities/Serializable";
import ChannelSchemaBuilder from "../Database/ChannelSchemaBuilder";
import QueryBuilder from "../Database/QueryBuilder";
import {ChannelTables} from "../Database/Database";
import {Observable, ObservableArray} from "../Utilities/Observable";
import ChannelSettings from "../Utilities/ChannelSettings";

export default class Channel implements Serializable {
    public disabledModules: ObservableArray<string>;
    public online: Observable<boolean>;
    private tablesExist: boolean;
    private settings: ChannelSettings;

    constructor(private id: string, private name: string) {
        this.disabledModules = new ObservableArray<string>();
        this.disabledModules.attach(this.save.bind(this));
        this.online = new Observable<boolean>(false);
        this.tablesExist = false;
        this.settings = new ChannelSettings(this);

        this.createTableSchema();
        Application.getChannelManager().add(this);
    }

    static async findByName(name: string) {
        let row = await Application.getDatabase().table("channels").select().where().eq("name", name).done().first();
        if (row === null) return null;

        let channel = new Channel(row.id, row.name);
        channel.disabledModules.set(row.disabled_modules);
        channel.tablesExist = true;
        return channel;
    }

    static deserialize(input: string) {
        let {id, name, disabledModules} = JSON.parse(input);
        let channel = new Channel(id, name);
        channel.disabledModules.set(disabledModules);
        return channel;
    }

    getId() {
        return this.id;
    }

    getName() {
        return this.name;
    }

    getSettings() {
        return this.settings;
    }

    query(table: ChannelTables): QueryBuilder {
        return Application.getDatabase().channelTable(this, table);
    }

    async exists(): Promise<boolean> {
        try {
            let count = await Application.getDatabase().table("channels")
                .count()
                .where().eq("id", this.getId()).done()
                .exec();
            return count > 0;
        } catch (e) {
            Application.getLogger().error("Unable to verify the existence of the channel in the database", {cause: e});
            return false;
        }
    }

    async save(): Promise<void> {
        await Application.getDatabase().table("channels").insert({
            id: this.getId(),
            name: this.getName(),
            disabled_modules: this.disabledModules.get()
        }).or("REPLACE").exec();

        if (!this.tablesExist) {
            await this.createTables();
            this.tablesExist = true;
        }
    }

    async load(): Promise<void> {
        let rows = await Application.getDatabase().table("channels")
            .select("*")
            .where().eq("id", this.id).done()
            .all();

        if (rows.length < 1) return;

        this.disabledModules.set(rows[0].disabled_modules);
        this.tablesExist = true;
    }

    async clearCache() {
        return Application.getCache().delMatches("channel.*");
    }

    serialize(): string {
        return JSON.stringify({
            id: this.id,
            name: this.name,
            disabledModules: this.disabledModules.get()
        });
    }

    private createTableSchema() {
        let builder = new ChannelSchemaBuilder(Application.getDatabase(), this);
        builder.addTable("users", table => {
            table.string('id').unique();
            table.string('name');
            table.integer('balance');
            table.boolean('banned');
            table.boolean('regular');
        });
        for (let module of Application.getModuleManager().getAll()) module.createDatabaseTables(builder);
    }

    private async createTables() {
        return Application.getDatabase().createChannelTables(this);
    }
}

export class ChannelStateList<T> {
    private readonly list: { [key: string]: T };
    private readonly defVal: T;

    constructor(defVal: T) {
        this.list = {};
        this.defVal = defVal;
    }

    hasChannel(channel: Channel) {
        return this.list.hasOwnProperty(channel.getId());
    }

    getChannel(channel: Channel): T {
        if (!this.hasChannel(channel))
            this.list[channel.getId()] = this.defVal;

        return this.list[channel.getId()];
    }

    setChannel(channel: Channel, value: T) {
       this.list[channel.getId()] = value;
    }

    deleteChannel(channel: Channel) {
        delete this.list[channel.getId()];
    }
}