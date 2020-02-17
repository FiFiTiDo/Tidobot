import AbstractModule, {ModuleConstructor} from "./AbstractModule";
import Channel from "../Chat/Channel";
import Application from "../Application/Application";

export default class ModuleManager {
    private modules: { [key: string]: AbstractModule };

    constructor() {
        this.modules = {};
    }

    registerModule(module: AbstractModule): void {
        module.mm = this;
        Application.getAdapter().addSubscriber(module);
        this.modules[module.getName()] = module;
    }

    init() {
        for (let module of Object.values(this.modules)) module.initialize();
        for (let module of Object.values(this.modules)) module.postInitialize();
    }

    findModuleByName<T extends AbstractModule>(module_name: string): T | null {
        if (!this.modules.hasOwnProperty(module_name))
            throw new Error("Invalid reference to module " + module_name + ", module not found.");

        return <T>this.modules[module_name];
    }

    getModule<T extends AbstractModule>(module: ModuleConstructor<T>): T {
        if (!this.modules.hasOwnProperty(module.name))
            throw new Error("Invalid reference to module " + module.name + ", module not found.");

        return <T>this.modules[module.name];
    }

    getAll(): AbstractModule[] {
        return Object.values(this.modules);
    }

    reset(channel: Channel): Promise<any> {
        let promises: Promise<any>[] = [];
        for (let module of Object.values(this.modules))
            promises.push(module.enable(channel));
        return Promise.all(promises);
    }

    clear(): void {
        this.modules = {};
    }
}