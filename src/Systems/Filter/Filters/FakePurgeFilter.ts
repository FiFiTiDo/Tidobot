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
    constructor(strikeManager: StrikeManager) {
        super(strikeManager);

        const settings = SettingsSystem.getInstance();
        settings.registerSetting(new Setting("filter.fake-purge.enabled", "true", SettingType.BOOLEAN));

        const perm = PermissionSystem.getInstance();
        perm.registerPermission(new Permission("filter.ignore.fake-purge", Role.MODERATOR));
    }

    async handleMessage(lists: FiltersEntity, { message, response, sender, channel }: MessageEventArgs): Promise<boolean> {
        if (await message.checkPermission("filter.ignore.fake-purge")) return false;
        const enabled = await channel.getSetting<boolean>("filter.fake-purge.enabled");
        if (!enabled) return false;

        if (FAKE_PURGE.test(message.getRaw())) {
            await this.strikeManager.issueStrike("fake-purge", message);
            return true;
        }

        return false;
    }
}