import Filter from "./Filter";
import StrikeManager from "../StrikeManager";
import FiltersEntity from "../../../Database/Entities/FiltersEntity";
import {MessageEventArgs} from "../../../Chat/Events/MessageEvent";
import Setting, {Integer, SettingType} from "../../Settings/Setting";
import SettingsSystem from "../../Settings/SettingsSystem";
import PermissionSystem from "../../Permissions/PermissionSystem";
import Permission from "../../Permissions/Permission";
import {Role} from "../../Permissions/Role";

const NON_ALPHA_PATTERN = /([^a-z0-9 ])/ig;
const NON_ALPHA_SEQ_PATTERN = /([^a-z0-9 ])(\1+)/ig;

export default class SymbolFilter extends Filter {
    private static ENABLED = new Setting("filter.symbols.enabled", true, SettingType.BOOLEAN);
    private static LENGTH = new Setting("filter.symbols.length", 20 as Integer, SettingType.INTEGER);
    private static MIN_LENGTH = new Setting("filter.symbols.min-length", 10 as Integer, SettingType.INTEGER);
    private static PERCENT = new Setting("filter.symbols.percent", 50 as Integer, SettingType.INTEGER);

    private static IGNORE_FILER = new Permission("filter.ignore.symbols", Role.MODERATOR);

    constructor(strikeManager: StrikeManager) {
        super(strikeManager);

        const settings = SettingsSystem.getInstance();
        settings.registerSetting(SymbolFilter.ENABLED);
        settings.registerSetting(SymbolFilter.LENGTH);
        settings.registerSetting(SymbolFilter.MIN_LENGTH);
        settings.registerSetting(SymbolFilter.PERCENT);

        const perm = PermissionSystem.getInstance();
        perm.registerPermission(new Permission("filter.ignore.symbols", Role.MODERATOR));
    }

    async handleMessage(lists: FiltersEntity, {message, channel, sender, response}: MessageEventArgs): Promise<boolean> {
        if (await message.checkPermission(SymbolFilter.IGNORE_FILER)) return false;
        if (!(await channel.getSetting(SymbolFilter.ENABLED))) return false;

        const stripped = message.getStripped();
        const minLength = await channel.getSetting(SymbolFilter.MIN_LENGTH);
        if (stripped.length < minLength) return false;

        const sequences = NON_ALPHA_SEQ_PATTERN.exec(stripped) ?? [];
        if (sequences.length > 0) {
            const maxLength = await channel.getSetting(SymbolFilter.LENGTH);
            const longest = sequences.sort((a, b) => b.length - a.length)[0].length;
            if (longest >= maxLength) {
                await this.strikeManager.issueStrike("symbols", message);
                return true;
            }
        }

        const maxPercent = await channel.getSetting(SymbolFilter.PERCENT);
        const nonAlphaChars = NON_ALPHA_PATTERN.exec(stripped) || [];
        const percent = (nonAlphaChars.length / stripped.length) * 100;

        if (percent < maxPercent) return false;

        await this.strikeManager.issueStrike("symbols", message);
        return true;
    }

}