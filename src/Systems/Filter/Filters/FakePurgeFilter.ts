import Filter from "./Filter";
import FiltersEntity from "../../../Database/Entities/FiltersEntity";
import {MessageEventArgs} from "../../../Chat/Events/MessageEvent";
import SettingsSystem from "../../Settings/SettingsSystem";
import Setting, {SettingType} from "../../Settings/Setting";
import PermissionSystem from "../../Permissions/PermissionSystem";
import Permission from "../../Permissions/Permission";
import {Role} from "../../Permissions/Role";

const FAKE_PURGE = /^<message \w+>|^<\w+ deleted>/i;
import { Service } from "typedi";

@Service()
export default class FakePurgeFilter extends Filter {
    private static ENABLED = new Setting("filter.fake-purge.enabled", true, SettingType.BOOLEAN);

    private static IGNORE_FILTER = new Permission("filter.ignore.fake-purge", Role.MODERATOR);

    constructor(settings: SettingsSystem, perm: PermissionSystem) {
        super();

        settings.registerSetting(FakePurgeFilter.ENABLED);
        perm.registerPermission(FakePurgeFilter.IGNORE_FILTER);
    }

    async handleMessage({message, channel}: MessageEventArgs): Promise<boolean> {
        if (await message.checkPermission(FakePurgeFilter.IGNORE_FILTER)) return false;
        if (!channel.settings.get(FakePurgeFilter.ENABLED)) return false;

        if (FAKE_PURGE.test(message.getRaw())) {
            await this.strikeManager.issueStrike("fake-purge", message);
            return true;
        }

        return false;
    }
}