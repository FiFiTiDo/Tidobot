import Filter from "./Filter";
import FiltersEntity from "../../../Database/Entities/FiltersEntity";
import {MessageEventArgs} from "../../../Chat/Events/MessageEvent";
import StrikeManager from "../StrikeManager";
import SettingsSystem from "../../Settings/SettingsSystem";
import Setting, {Integer, SettingType} from "../../Settings/Setting";
import PermissionSystem from "../../Permissions/PermissionSystem";
import Permission from "../../Permissions/Permission";
import {Role} from "../../Permissions/Role";

const REPEATED_SEQ_PATTERN = /(.)(\1+)/ig;

export default class RepetitionFilter extends Filter {
    private static ENABLED = new Setting("filter.repetition.enabled", true, SettingType.BOOLEAN);
    private static LENGTH = new Setting("filter.repetition.length", 20 as Integer, SettingType.INTEGER);

    private static IGNORE_FILTER = new Permission("filter.ignore.repetition", Role.MODERATOR);

    constructor(strikeManager: StrikeManager) {
        super(strikeManager);

        const settings = SettingsSystem.getInstance();
        settings.registerSetting(RepetitionFilter.ENABLED);
        settings.registerSetting(RepetitionFilter.LENGTH);

        const perm = PermissionSystem.getInstance();
        perm.registerPermission(RepetitionFilter.IGNORE_FILTER);
    }

    async handleMessage(lists: FiltersEntity, {channel, message}: MessageEventArgs): Promise<boolean> {
        if (await message.checkPermission(RepetitionFilter.IGNORE_FILTER)) return false;
        if (!(await channel.getSetting(RepetitionFilter.ENABLED))) return false;

        const sequences = REPEATED_SEQ_PATTERN.exec(message.getRaw());
        if (sequences === null) return false;

        const length = await channel.getSetting(RepetitionFilter.LENGTH);
        const longest = sequences.sort((a, b) => b.length - a.length)[0].length;

        if (longest < length) return false;

        await this.strikeManager.issueStrike("repetition", message);
        return true;
    }
}