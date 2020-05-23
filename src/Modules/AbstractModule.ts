import ChannelEntity from "../Database/Entities/ChannelEntity";
import {array_contains, array_remove} from "../Utilities/ArrayUtils";
import {injectable, unmanaged} from "inversify";
import CommandSystem from "../Systems/Commands/CommandSystem";
import PermissionSystem from "../Systems/Permissions/PermissionSystem";
import SettingsSystem from "../Systems/Settings/SettingsSystem";
import ExpressionSystem from "../Systems/Expressions/ExpressionSystem";

export interface ModuleInfo {
    name: string;
    version: string;
    description: string;
}

export interface Systems {
    command: CommandSystem;
    permission: PermissionSystem;
    settings: SettingsSystem;
    expression: ExpressionSystem;
}

@injectable()
export default abstract class AbstractModule {
    protected coreModule = false;
    private readonly name: string;

    protected constructor(@unmanaged() name: string) {
        this.name = name;
    }

    public abstract initialize(systems: Systems): ModuleInfo;

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
}