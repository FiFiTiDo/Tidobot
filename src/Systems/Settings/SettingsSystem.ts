import Setting from "./Setting";

export default class SettingsSystem {
    private static instance: SettingsSystem = null;

    public static getInstance(): SettingsSystem {
        if (this.instance === null)
            this.instance = new SettingsSystem();

        return this.instance;
    }

    private readonly settings: Map<string, Setting>;

    constructor() {
        this.settings = new Map();
    }

    registerSetting(setting: Setting): void {
        this.settings.set(setting.getKey(), setting);
    }

    getSetting(key: string): Setting|null {
        return this.settings.has(key) ? this.settings.get(key) : null;
    }

    getAll(): Setting[] {
        return Array.from(this.settings.values());
    }
}