import Filter from "./Filter";
import StrikeManager from "../StrikeManager";
import FiltersEntity from "../../../Database/Entities/FiltersEntity";
import {MessageEventArgs} from "../../../Chat/Events/MessageEvent";
import Setting, {SettingType} from "../../Settings/Setting";
import SettingsSystem from "../../Settings/SettingsSystem";
import PermissionSystem from "../../Permissions/PermissionSystem";
import Permission from "../../Permissions/Permission";
import {Role} from "../../Permissions/Role";

const SYMBOLS_PATTERN = /[`~!@#$%^&*()-_=+[{\]}\\|;:'",<.>/?]/g;

export default class SymbolFilter extends Filter {
    constructor(strikeManager: StrikeManager) {
        super(strikeManager);

        const settings = SettingsSystem.getInstance();
        settings.registerSetting(new Setting("filter.symbols.enabled", "true", SettingType.BOOLEAN));
        settings.registerSetting(new Setting("filter.symbols.amount", "20", SettingType.INTEGER));

        const perm = PermissionSystem.getInstance();
        perm.registerPermission(new Permission("filter.ignore.symbols", Role.MODERATOR));
    }

    async handleMessage(lists: FiltersEntity, { message, channel, sender, response }: MessageEventArgs): Promise<boolean> {
        if (await message.checkPermission("filter.ignore.symbols")) return false;
        const enabled = await channel.getSetting("filter.symbols.enabled");
        if (!enabled) return false;
        const max = await channel.getSetting("filter.symbols.amount");
        const symbols = message.getRaw().match(SYMBOLS_PATTERN) || [];

        if (symbols.length >= max) {
            await this.strikeManager.issueStrike("symbols", message);
            return true;
        }

        return false;
    }

}