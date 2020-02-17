import Dispatcher from "../Event/Dispatcher";
import ModuleManager from "./ModuleManager";
import Channel from "../Chat/Channel";
import Subscriber from "../Event/Subscriber";
import ChannelSchemaBuilder from "../Database/ChannelSchemaBuilder";

export interface ModuleConstructor<T extends AbstractModule> {
    name: string

    new(): T;
}

export default abstract class AbstractModule extends Dispatcher implements Subscriber {
    mm: ModuleManager;
    protected coreModule: boolean = false;
    private readonly name: string;

    protected constructor(name: string) {
        super();

        this.name = name;
    }

    public initialize() {
    }

    public postInitialize() {
    }

    public registerListeners(dispatcher: Dispatcher) {
    }

    public unregisterListeners(dispatcher: Dispatcher) {
    }

    public createDatabaseTables(builder: ChannelSchemaBuilder) {
    }

    public async onCreateTables(channel: Channel) {
    }


    getName(): string {
        return this.name;
    }

    async disable(channel: Channel) {
        if (this.coreModule) return;
        if (this.isDisabled(channel)) return;
        channel.disabledModules.add(this.getName());
    }

    async enable(channel: Channel) {
        if (this.coreModule) return;
        if (!this.isDisabled(channel)) return;
        channel.disabledModules.remove(this.getName());
    }

    isDisabled(channel: Channel): boolean {
        return !this.coreModule && channel.disabledModules.has(this.getName());
    }

    protected getModuleManager() {
        return this.mm;
    }
}