import ChannelEntity from "../Database/Entities/ChannelEntity";
import {arrayContains, arrayRemove} from "../Utilities/ArrayUtils";
import CommandSystem from "../Systems/Commands/CommandSystem";
import PermissionSystem from "../Systems/Permissions/PermissionSystem";
import SettingsSystem from "../Systems/Settings/SettingsSystem";
import ExpressionSystem from "../Systems/Expressions/ExpressionSystem";
import {getSettings} from "../Systems/Settings/decorators";
import Setting from "../Systems/Settings/Setting";
import {getResolvers} from "../Systems/Expressions/decorators";
import {getPermissions} from "../Systems/Permissions/decorators";
import Permission from "../Systems/Permissions/Permission";
import {getCommands} from "../Systems/Commands/decorators";
import Command from "../Systems/Commands/Command";

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

export const Symbols = {
    ModuleInfo: Symbol("Module Information")
} as {
    readonly ModuleInfo: unique symbol
};

export interface ModuleConstructor<T extends AbstractModule> {
    name: string;
    [Symbols.ModuleInfo]: ModuleInfo;

    new(...args: any[]): T;
}

export default abstract class AbstractModule {
    protected coreModule = false;
    private readonly name: string;
    private readonly info: ModuleInfo;

    protected constructor(constructor: ModuleConstructor<any>) {
        this.name = constructor.name;
        this.info = constructor[Symbols.ModuleInfo];

        const commands = CommandSystem.getInstance();
        for (const property of getCommands(constructor)) {
            const command = this[property];
            if (command instanceof Command)
                commands.registerCommand(command, this);
            else
                throw new Error("Invalid module configuration, property " + property.toString() + " is defined as a command but is not a command");
        }

        const settings = SettingsSystem.getInstance();
        for (const property of getSettings(constructor)) {
            const setting = this[property];
            if (setting instanceof Setting)
                settings.registerSetting(setting);
            else
                throw new Error("Invalid module configuration, property " + property.toString() + " is defined as a setting but is not a setting");
        }

        const expression = ExpressionSystem.getInstance();
        for (const resolver of getResolvers(constructor))
            expression.registerResolver(this[resolver].bind(this));

        const permissions = PermissionSystem.getInstance();
        for (const property of getPermissions(constructor)) {
            const permission = this[property];
            if (permission instanceof Permission)
                permissions.registerPermission(permission);
            else
                throw new Error("Invalid module configuration, property " + property.toString() + " is defined as a permission but is not a permission");
        }
    }

    getName(): string {
        return this.name;
    }

    getInfo(): ModuleInfo {
        return this.info;
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
        arrayRemove(this.getName(), channel.disabledModules);
        return channel.save();
    }

    isDisabled(channel: ChannelEntity): boolean {
        return !this.coreModule && arrayContains(this.getName(), channel.disabledModules);
    }
}