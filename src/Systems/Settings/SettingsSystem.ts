import Setting, {SettingType} from "./Setting";
import System from "../System";
import { Service } from "typedi";
import { EventHandler, HandlesEvents } from "../Event/decorators";
import Event from "../Event/Event";
import { NewChannelEvent } from "../../Chat/Events/NewChannelEvent";
import { Channel } from "../../Database/Entities/Channel";

@Service()
@HandlesEvents()
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

    async resetSettings(channel: Channel): Promise<void> {
        channel.settings.clear();
        for (const setting of this.settings.values())
            channel.settings.set(setting, setting.defaultValue);
        await channel.settings.save();
    }

    @EventHandler(NewChannelEvent)
    async onNewChannel(event: Event): Promise<void> {
        const channel = event.extra.get(NewChannelEvent.EXTRA_CHANNEL);
        await this.resetSettings(channel);
    }
}