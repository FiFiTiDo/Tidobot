import AbstractModule, {ModuleConstructor} from "./AbstractModule";
import ChannelEntity from "../Database/Entities/ChannelEntity";
import Bot from "../Application/Bot";
import {inject, injectable} from "inversify";
import Adapter from "../Services/Adapter";
import {ALL_MODULES_KEY} from "./index";
import {objectHasProperties} from "../Utilities/ObjectUtils";

@injectable()
export default class ModuleManager {
    private modules: { [key: string]: AbstractModule };

    constructor(@inject(ALL_MODULES_KEY) modules: AbstractModule[], private bot: Bot, private adapter: Adapter) {
        this.modules = {};

        for (const module of modules) {
            this.adapter.addSubscriber(module);
            this.modules[module.getName()] = module;
        }

        for (const module of Object.values(this.modules)) module.initialize();
        for (const module of Object.values(this.modules)) module.postInitialize();
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