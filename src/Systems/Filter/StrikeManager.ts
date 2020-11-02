import Setting, {Integer, SettingType} from "../Settings/Setting";
import SettingsSystem from "../Settings/SettingsSystem";
import Message from "../../Chat/Message";
import System from "../System";
import {logError} from "../../Utilities/Logger";
import { Service } from "typedi";
import { Chatter } from "../../Database/Entities/Chatter";
import { EntityStateList } from "../../Database/EntityStateLiist";

@Service()
export default class StrikeManager extends System {
    private static STRIKE_1 = new Setting("filter.strike.1", 1 as Integer, SettingType.INTEGER);
    private static STRIKE_2 = new Setting("filter.strike.2", 600 as Integer, SettingType.INTEGER);
    private static STRIKE_3 = new Setting("filter.strike.3", 28800 as Integer, SettingType.INTEGER);
    private static STRIKEOUT = new Setting("filter.strikeout", -1 as Integer, SettingType.INTEGER);
    private strikes: EntityStateList<Chatter, number> = new EntityStateList<Chatter, number>(0);

    constructor(settings: SettingsSystem) {
        super("StrikeManager");

        settings.registerSetting(StrikeManager.STRIKE_1);
        settings.registerSetting(StrikeManager.STRIKE_2);
        settings.registerSetting(StrikeManager.STRIKE_3);
        settings.registerSetting(StrikeManager.STRIKEOUT);

        this.logger.info("System initialized");
    }

    private getStrikeSetting(strikeNum: number): Setting<SettingType.INTEGER> {
        switch (strikeNum) {
            case 3: return StrikeManager.STRIKE_3;
            case 2: return StrikeManager.STRIKE_2;
            case 1: return StrikeManager.STRIKE_1;
        }
    }

    public async issueStrike(type: string, message: Message): Promise<void> {
        const chatter = message.getChatter();
        const channel = message.getChannel();
        const response = message.getResponse();
        const adapter = message.getAdapter();
        const strike = (this.strikes.get(chatter) + 1) % 4;
        this.strikes.set(chatter, strike);
        const reason = await response.translate(`filter:reasons.${type}`);
        const banReason = await response.translate("filter:ban-reason", {
            reason: await response.translate(`filter:ban-reasons.${type}`)
        });

        try {
            if (strike === 0) {
                const length = channel.settings.get(StrikeManager.STRIKEOUT);
                const strikeoutReason = await response.translate("filter:strikeout", {reason: banReason});
                if (length < 0)
                    await adapter.banChatter(chatter, strikeoutReason);
                else
                    await adapter.tempbanChatter(chatter, length, strikeoutReason);
                this.logger.info(`Final strike issued for the user ${chatter.user.name} in the channel ${chatter.channel.name}, reason: ${banReason}`);
            } else {
                await response.message("filter:strike", {username: chatter.user.name, reason, number: strike});
                const length = chatter.channel.settings.get(this.getStrikeSetting(strike));
                if (length > 0) await adapter.tempbanChatter(chatter, length, banReason);
                this.logger.info(`Strike ${strike} issued for the user ${chatter.user.name} in the channel ${chatter.channel.name}, reason: ${banReason}`);
            }
        } catch (e) {
            logError(this.logger, e, "Unable to ban user while issuing strike");
        }
    }

    public pardonUser(chatter: Chatter): void {
        this.strikes.set(chatter, 0);
    }
}