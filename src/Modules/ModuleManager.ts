import {inject, injectable} from "inversify";
import {ALL_MODULES_KEY} from "./index";
import ChannelEntity from "../Database/Entities/ChannelEntity";
import AbstractModule from "./AbstractModule";
import {getLogger} from "../Utilities/Logger";
import CommandSystem from "../Systems/Commands/CommandSystem";
import PermissionSystem from "../Systems/Permissions/PermissionSystem";
import SettingsSystem from "../Systems/Settings/SettingsSystem";
import ExpressionSystem from "../Systems/Expressions/ExpressionSystem";

@injectable()
export default class ModuleManager {
    private static readonly LOGGER = getLogger("ModuleManager");

    private modules: { [key: string]: AbstractModule };

    constructor(@inject(ALL_MODULES_KEY) modules: AbstractModule[]) {
        this.modules = {};

        for (const module of modules) this.modules[module.getName()] = module;

        const systems = {
            command: CommandSystem.getInstance(),
            permission: PermissionSystem.getInstance(),
            settings: SettingsSystem.getInstance(),
            expression: ExpressionSystem.getInstance()
        };

        ModuleManager.LOGGER.info("Initializing modules");
        for (const module of Object.values(this.modules)) {
            try {
                const info = module.initialize(systems);
                ModuleManager.LOGGER.info(`Initialized module ${info.name} v${info.version}`);
            } catch (e) {
                ModuleManager.LOGGER.fatal("An error occurred while initializing the module " + module.getName());
                ModuleManager.LOGGER.fatal("Caused by: " + e.message);
                ModuleManager.LOGGER.fatal(e.stack);
            }
        }
    }

    async reset(channel: ChannelEntity): Promise<void> {
        const promises = [];
        for (const module of Object.values(this.modules))
            promises.push(module.enable(channel));
        await Promise.all(promises);
    }

    clear(): void {
        this.modules = {};
    }
}