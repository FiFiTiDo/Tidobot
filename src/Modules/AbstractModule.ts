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
import { Channel } from "../NewDatabase/Entities/Channel";
import { DisabledModule } from "../NewDatabase/Entities/DisabledModule";
import { Inject, Service } from "typedi";
import { Repository } from "typeorm";
import { InjectRepository } from "typeorm-typedi-extensions";

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

@Service()
export default abstract class AbstractModule {
    protected coreModule = false;
    private readonly name: string;
    private readonly info: ModuleInfo;

    @Inject()
    public readonly commandSystem: CommandSystem;

    @Inject()
    public readonly settingsSystem: SettingsSystem;

    @Inject()
    public readonly expressionSystem: ExpressionSystem;

    @Inject()
    public readonly permissionSystem: PermissionSystem;

    @InjectRepository()
    private readonly disabledModulesRepository: Repository<DisabledModule>;

    protected constructor(private readonly ctor: ModuleConstructor<any>) {
        this.name = ctor.name;
        this.info = ctor[Symbols.ModuleInfo];
    }

    initalize() {
        for (const property of getCommands(this.ctor)) {
            const command = this[property];
            if (command instanceof Command)
                this.commandSystem.registerCommand(command, this);
            else
                throw new Error("Invalid module configuration, property " + property.toString() + " is defined as a command but is not a command");
        }

        for (const property of getSettings(this.ctor)) {
            const setting = this[property];
            if (setting instanceof Setting)
                this.settingsSystem.registerSetting(setting);
            else
                throw new Error("Invalid module configuration, property " + property.toString() + " is defined as a setting but is not a setting");
        }

        for (const resolver of getResolvers(this.ctor))
            this.expressionSystem.registerResolver(this[resolver].bind(this));

        for (const property of getPermissions(this.ctor)) {
            const permission = this[property];
            if (permission instanceof Permission)
                this.permissionSystem.registerPermission(permission);
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

    async disable(channel: Channel): Promise<void> {
        if (this.coreModule) return;
        if (this.isDisabled(channel)) return;
        const disabledModule = new DisabledModule();
        disabledModule.channel = channel;
        disabledModule.moduleName = this.getName();
        await this.disabledModulesRepository.save(disabledModule)
    }

    async enable(channel: Channel): Promise<DisabledModule> {
        if (this.coreModule) return;
        if (!this.isDisabled(channel)) return;
        
        for (const disabledModule of channel.disabledModules)
            if (disabledModule.moduleName === this.getName())
                return disabledModule.remove();
    }

    isDisabled(channel: Channel): boolean {
        if (this.coreModule) return false;

        for (const disabledModule of channel.disabledModules)
            if (disabledModule.moduleName === this.getName())
                return true;

        return false;
    }
}