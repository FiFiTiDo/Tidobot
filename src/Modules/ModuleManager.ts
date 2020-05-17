import {inject, injectable} from "inversify";
import {ALL_MODULES_KEY} from "./index";
import ChannelEntity from "../Database/Entities/ChannelEntity";
import AbstractModule from "./AbstractModule";
import Logger from "../Utilities/Logger";

@injectable()
export default class ModuleManager {
    private modules: { [key: string]: AbstractModule };

    constructor(@inject(ALL_MODULES_KEY) modules: AbstractModule[]) {
        this.modules = {};

        for (const module of modules) this.modules[module.getName()] = module;

        for (const module of Object.values(this.modules)) {
            try {
                module.initialize();
                Logger.get().debug("Initialized module " + module.getName());
            } catch (err) {
                Logger.get().emerg("An error occurred while initializing the module " + module.getName(), { cause: err });
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