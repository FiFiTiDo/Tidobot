import Setting from "./Setting";
import System from "../System";

export default class SettingsSystem extends System {
    private static instance: SettingsSystem = null;
    private readonly settings: Map<string, Setting>;

    constructor() {
        super("Settings");
        this.settings = new Map();
        this.logger.info("System initialized");
    }

    public static getInstance(): SettingsSystem {
        if (this.instance === null)
            this.instance = new SettingsSystem();

        return this.instance;
    }

    registerSetting(setting: Setting): void {
        this.settings.set(setting.getKey(), setting);
    }

    getSetting(key: string): Setting | null {
        return this.settings.has(key) ? this.settings.get(key) : null;
    }

    getAll(): Setting[] {
        const settings = [];
        for (const [, setting] of this.settings)
            settings.push(setting);
        return settings;
    }
}