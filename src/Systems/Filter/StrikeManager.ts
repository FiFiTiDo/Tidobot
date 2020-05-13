import ChatterEntity, {ChatterStateList} from "../../Database/Entities/ChatterEntity";
import {Response} from "../../Chat/Response";
import Setting, {SettingType} from "../Settings/Setting";
import SettingsSystem from "../Settings/SettingsSystem";
import Adapter from "../../Services/Adapter";
import Logger from "../../Utilities/Logger";
import Message from "../../Chat/Message";


export default class StrikeManager {
    private strikes: ChatterStateList<number> = new ChatterStateList<number>(0);

    constructor() {
        const settings = SettingsSystem.getInstance();
        settings.registerSetting(new Setting("filter.strike.1", "0", SettingType.INTEGER));
        settings.registerSetting(new Setting("filter.strike.2", "600", SettingType.INTEGER));
        settings.registerSetting(new Setting("filter.strike.3", "28800", SettingType.INTEGER));
        settings.registerSetting(new Setting("filter.strikeout", "-1", SettingType.INTEGER));
    }

    public async issueStrike(type: string, message: Message) {
        const chatter = message.getChatter();
        const response = message.getResponse();
        const adapter = message.getAdapter();
        const strike = (this.strikes.getChatter(chatter) + 1) % 4;
        this.strikes.setChatter(chatter, strike);
        const reason = await response.translate(`filter:reasons.${type}`);
        const banReason = await response.translate("filter:ban-reason", {
            reason: await response.translate(`filter:ban-reasons.${type}`)
        });

        try {
            if (strike === 0) {
                const length = await chatter.getChannel().getSetting<number>("filter.strikeout");
                if (length < 0)
                    await adapter.banChatter(chatter, await response.translate("filter:strikeout", {
                        reason: banReason
                    }));
                else
                    await adapter.tempbanChatter(chatter, length, await response.translate("filter:strikeout", {
                        reason: banReason
                    }));
                Logger.get().info(`Final strike issued for the user ${chatter.name} in the channel ${chatter.getChannel().name}, reason: ${banReason}`)
            } else {
                const length = await chatter.getChannel().getSetting<number>(`filter.strike.${strike}`);
                if (length > 0)
                    await adapter.tempbanChatter(chatter, length, banReason);
                Logger.get().info(`Strike ${strike} issued for the user ${chatter.name} in the channel ${chatter.getChannel().name}, reason: ${banReason}`)
            }
        } catch (err) {
            await response.message("filter:strike", {username: chatter.name, reason, number: strike});
            Logger.get().error("Unable to ban user while issuing strike", { cause: err });
        }
    }
}