import Filter from "./Filter";
import StrikeManager from "../StrikeManager";
import FiltersEntity from "../../../Database/Entities/FiltersEntity";
import {MessageEventArgs} from "../../../Chat/Events/MessageEvent";
import Setting, {SettingType} from "../../Settings/Setting";
import SettingsSystem from "../../Settings/SettingsSystem";
import PermissionSystem from "../../Permissions/PermissionSystem";
import Permission from "../../Permissions/Permission";
import {Role} from "../../Permissions/Role";

const NON_ALPHA_PATTERN = /([^a-z0-9 ])/ig;
const NON_ALPHA_SEQ_PATTERN = /([^a-z0-9 ])(\1+)/ig;

export default class SymbolFilter extends Filter {
    constructor(strikeManager: StrikeManager) {
        super(strikeManager);

        const settings = SettingsSystem.getInstance();
        settings.registerSetting(new Setting("filter.symbols.enabled", "true", SettingType.BOOLEAN));
        settings.registerSetting(new Setting("filter.symbols.length", "20", SettingType.INTEGER));
        settings.registerSetting(new Setting("filter.symbols.percent", "50", SettingType.INTEGER));

        const perm = PermissionSystem.getInstance();
        perm.registerPermission(new Permission("filter.ignore.symbols", Role.MODERATOR));
    }

    async handleMessage(lists: FiltersEntity, {message, channel, sender, response}: MessageEventArgs): Promise<boolean> {
        if (await message.checkPermission("filter.ignore.symbols")) return false;
        const enabled = await channel.getSetting("filter.symbols.enabled");
        if (!enabled) return false;

        const stripped = message.getStripped();

        const sequences = NON_ALPHA_SEQ_PATTERN.exec(stripped) || [];
        if (sequences.length > 0) {
            const maxLength = await channel.getSetting<number>("filter.symbols.length");
            const longest = sequences.sort((a, b) => b.length - a.length)[0].length;
            if (longest >= maxLength) {
                await this.strikeManager.issueStrike("symbols", message);
                return true;
            }
        }

        const maxPercent = await channel.getSetting("filter.symbols.percent");
        const nonAlphaChars = NON_ALPHA_PATTERN.exec(stripped) || [];
        const percent = (nonAlphaChars.length / stripped.length) * 100;

        if (percent >= maxPercent) {
            await this.strikeManager.issueStrike("symbols", message);
            return true;
        }

        return false;
    }

}