import ModuleManager from "./ModuleManager";
import ChannelEntity from "../Database/Entities/ChannelEntity";
import Bot from "../Application/Bot";
import {inject, injectable} from "inversify";
import symbols from "../symbols";
import ChannelManager from "../Chat/ChannelManager";
import {ConfirmationFactory} from "./ConfirmationModule";
import Config from "../Utilities/Config";
import {array_contains, array_remove} from "../Utilities/ArrayUtils";

export interface ModuleConstructor<T extends AbstractModule> {
    name: string;
    new(...any): T;
}

@injectable()
export default abstract class AbstractModule {

    @inject(ModuleManager)
    protected moduleManager: ModuleManager;

    @inject(Bot)
    protected bot: Bot;

    @inject(ChannelManager)
    protected channelManager: ChannelManager;

    @inject(symbols.ConfirmationFactory)
    protected makeConfirmation: ConfirmationFactory;

    @inject(symbols.Config)
    protected config: Config;

    protected coreModule = false;
    private readonly name: string;

    protected constructor(name: string) {
        this.name = name;
    }

    public initialize(): void {
        // Not implemented
    }

    getName(): string {
        return this.name;
    }

    async disable(channel: ChannelEntity): Promise<void> {
        if (this.coreModule) return;
        if (this.isDisabled(channel)) return;
        channel.disabledModules.push(this.getName());
        return channel.save();
    }

    async enable(channel: ChannelEntity): Promise<void> {
        if (this.coreModule) return;
        if (!this.isDisabled(channel)) return;
        array_remove(this.getName(), channel.disabledModules);
        return channel.save();
    }

    isDisabled(channel: ChannelEntity): boolean {
        return !this.coreModule && array_contains(this.getName(), channel.disabledModules);
    }

    protected getModuleManager(): ModuleManager {
        return this.moduleManager;
    }
}