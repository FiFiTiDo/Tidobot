import Filter from "./Filter";
import FiltersEntity from "../../../Database/Entities/FiltersEntity";
import {MessageEventArgs} from "../../../Chat/Events/MessageEvent";
import StrikeManager from "../StrikeManager";
import SettingsSystem from "../../Settings/SettingsSystem";
import Setting, {SettingType} from "../../Settings/Setting";
import PermissionSystem from "../../Permissions/PermissionSystem";
import Permission from "../../Permissions/Permission";
import {Role} from "../../Permissions/Role";

const FAKE_PURGE = /^<message \w+>|^<\w+ deleted>/i;

export default class FakePurgeFilter extends Filter {
    private static ENABLED = new Setting("filter.fake-purge.enabled", true, SettingType.BOOLEAN);

    private static IGNORE_FILTER = new Permission("filter.ignore.fake-purge", Role.MODERATOR);

    constructor(strikeManager: StrikeManager) {
        super(strikeManager);

        const settings = SettingsSystem.getInstance();
        settings.registerSetting(FakePurgeFilter.ENABLED);

        const perm = PermissionSystem.getInstance();
        perm.registerPermission(FakePurgeFilter.IGNORE_FILTER);
    }

    async handleMessage(lists: FiltersEntity, {message, response, sender, channel}: MessageEventArgs): Promise<boolean> {
        if (await message.checkPermission(FakePurgeFilter.IGNORE_FILTER)) return false;
        if (!(await channel.getSetting(FakePurgeFilter.ENABLED))) return false;

        if (FAKE_PURGE.test(message.getRaw())) {
            await this.strikeManager.issueStrike("fake-purge", message);
            return true;
        }

        return false;
    }
}