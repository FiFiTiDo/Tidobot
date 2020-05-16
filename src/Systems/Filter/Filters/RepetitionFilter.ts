import Filter from "./Filter";
import FiltersEntity from "../../../Database/Entities/FiltersEntity";
import {MessageEventArgs} from "../../../Chat/Events/MessageEvent";
import StrikeManager from "../StrikeManager";
import SettingsSystem from "../../Settings/SettingsSystem";
import Setting, {SettingType} from "../../Settings/Setting";
import PermissionSystem from "../../Permissions/PermissionSystem";
import Permission from "../../Permissions/Permission";
import {Role} from "../../Permissions/Role";

const REPEATED_SEQ_PATTERN = /(.)(\1+)/ig;

export default class RepetitionFilter extends Filter {
    constructor(strikeManager: StrikeManager) {
        super(strikeManager);

        const settings = SettingsSystem.getInstance();
        settings.registerSetting(new Setting("filter.repetition.enabled", "true", SettingType.BOOLEAN));
        settings.registerSetting(new Setting("filter.repetition.length", "20", SettingType.INTEGER));

        const perm = PermissionSystem.getInstance();
        perm.registerPermission(new Permission("filter.ignore.repetition", Role.MODERATOR));
    }

    async handleMessage(lists: FiltersEntity, {channel, message}: MessageEventArgs): Promise<boolean> {
        if (await message.checkPermission("filter.ignore.repetition")) return false;
        const enabled = await channel.getSetting<boolean>("filter.repetition.enabled");
        if (!enabled) return false;

        const sequences = REPEATED_SEQ_PATTERN.exec(message.getRaw());
        if (sequences === null) return false;

        const length = await channel.getSetting<number>("filter.repetition.length");
        const longest = sequences.sort((a, b) => b.length - a.length)[0].length;

        if (longest >= length) {
            await this.strikeManager.issueStrike("repetition", message);
            return true;
        }

        return false;
    }
}