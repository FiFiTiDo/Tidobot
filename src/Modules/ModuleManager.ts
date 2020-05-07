import AbstractModule, {ModuleConstructor} from "./AbstractModule";
import ChannelEntity from "../Database/Entities/ChannelEntity";
import {inject, injectable} from "inversify";
import {ALL_MODULES_KEY} from "./index";
import {objectHasProperties} from "../Utilities/ObjectUtils";

@injectable()
export default class ModuleManager {
    private modules: { [key: string]: AbstractModule };

    constructor(@inject(ALL_MODULES_KEY) modules: AbstractModule[]) {
        this.modules = {};

        for (const module of modules) this.modules[module.getName()] = module;
        for (const module of Object.values(this.modules)) module.initialize();
    }

    getModule<T extends AbstractModule>(module: ModuleConstructor<T>): T {
        if (!objectHasProperties(this.modules, module.name))
            throw new Error("Invalid reference to module " + module.name + ", module not found.");

        return this.modules[module.name] as T;
    }

    getAll(): AbstractModule[] {
        return Object.values(this.modules);
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