import AbstractModule from "./AbstractModule";
import {getLogger, logError} from "../Utilities/Logger";
import { Channel } from "../Database/Entities/Channel";
import { Service } from "typedi";
import { getAllModules } from "./modules";

@Service()
export default class ModuleManager {
    private static readonly LOGGER = getLogger("ModuleManager");

    private modules: { [key: string]: AbstractModule };

    constructor() {
        this.modules = {};

        for (const module of getAllModules()) this.modules[module.getName()] = module;

        ModuleManager.LOGGER.info("Initializing modules");
        for (const module of Object.values(this.modules)) {
            const info = module.getInfo();
            try {
                ModuleManager.LOGGER.info(`Initialized module ${info.name} v${info.version}`);
            } catch (e) {
                logError(ModuleManager.LOGGER, e, "An error occurred while initializing the module " + info.name, true);
            }
        }
    }

    async reset(channel: Channel): Promise<void> {
        const promises = [];
        for (const module of Object.values(this.modules))
            promises.push(module.enable(channel));
        await Promise.all(promises);
    }

    clear(): void {
        this.modules = {};
    }
}