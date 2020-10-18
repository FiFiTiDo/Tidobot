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
import { Service } from "typedi";

@Service()
export default class RepetitionFilter extends Filter {
    private static ENABLED = new Setting("filter.repetition.enabled", true, SettingType.BOOLEAN);
    private static LENGTH = new Setting("filter.repetition.length", 20 as Integer, SettingType.INTEGER);

    private static IGNORE_FILTER = new Permission("filter.ignore.repetition", Role.MODERATOR);

    constructor(settings: SettingsSystem, perm: PermissionSystem) {
        super();

        settings.registerSetting(RepetitionFilter.ENABLED);
        settings.registerSetting(RepetitionFilter.LENGTH);
        perm.registerPermission(RepetitionFilter.IGNORE_FILTER);
    }

    async handleMessage({message, channel}: MessageEventArgs): Promise<boolean> {
        if (await message.checkPermission(RepetitionFilter.IGNORE_FILTER)) return false;
        if (!channel.settings.get(RepetitionFilter.ENABLED)) return false;

        const sequences = REPEATED_SEQ_PATTERN.exec(message.getRaw());
        if (sequences === null) return false;

        const length = channel.settings.get(RepetitionFilter.LENGTH);
        const longest = sequences.sort((a, b) => b.length - a.length)[0].length;

        if (longest < length) return false;

        await this.strikeManager.issueStrike("repetition", message);
        return true;
    }
}