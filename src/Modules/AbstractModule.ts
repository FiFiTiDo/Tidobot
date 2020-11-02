import CommandSystem from "../Systems/Commands/CommandSystem";
import PermissionSystem from "../Systems/Permissions/PermissionSystem";
import SettingsSystem from "../Systems/Settings/SettingsSystem";
import ExpressionSystem, { ExpressionContextResolver } from "../Systems/Expressions/ExpressionSystem";
import Setting from "../Systems/Settings/Setting";
import Permission from "../Systems/Permissions/Permission";
import Command from "../Systems/Commands/Command";
import { Channel } from "../Database/Entities/Channel";
import { DisabledModule } from "../Database/Entities/DisabledModule";
import Container, { Inject, Service } from "typedi";
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
    readonly ModuleInfo: unique symbol;
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
    public readonly expressionSystem: ExpressionSystem;

    @InjectRepository()
    private readonly disabledModulesRepository: Repository<DisabledModule>;

    protected constructor(private readonly ctor: ModuleConstructor<any>) {
        this.name = ctor.name;
        this.info = ctor[Symbols.ModuleInfo];
    }

    registerCommand(command: Command): void {
        Container.get(CommandSystem).registerCommand(command, this);
    }

    registerCommands(...commands: Command[]): void {
        for (const command of commands) this.registerCommand(command);
    }

    registerPermissions(permissionsArg: Permission[]|{ [key: string]: Permission }): void {
        const permissions = permissionsArg instanceof Array ? permissionsArg : Object.values(permissionsArg);
        const permissionSystem = Container.get(PermissionSystem);
        for (const permission of permissions)
            permissionSystem.registerPermission(permission);
    }

    registerSettings(settingsArg: Setting<any>[]|{ [key: string]: Setting<any> }): void {
        const settings = settingsArg instanceof Array ? settingsArg : Object.values(settingsArg);
        const settingsSystem = Container.get(SettingsSystem);
        for (const setting of settings)
            settingsSystem.registerSetting(setting);
    }

    registerExpressionContextResolver(resolver: ExpressionContextResolver): void {
        Container.get(ExpressionSystem).registerResolver(resolver.bind(this));
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
        await this.disabledModulesRepository.save(disabledModule);
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