import Setting, {SettingType} from "./Setting";
import System from "../System";
import { Service } from "typedi";

@Service()
export default class SettingsSystem extends System {
    private readonly settings: Map<string, Setting<any>>;

    constructor() {
        super("Settings");
        this.settings = new Map();
        this.logger.info("System initialized");
    }

    registerSetting<T extends SettingType>(setting: Setting<T>): void {
        this.settings.set(setting.getKey(), setting);
    }

    getSetting<T extends SettingType>(key: string): Setting<T> | null {
        return this.settings.has(key) ? this.settings.get(key) : null;
    }

    getAll(): Setting<any>[] {
        const settings = [];
        for (const [, setting] of this.settings)
            settings.push(setting);
        return settings;
    }
}