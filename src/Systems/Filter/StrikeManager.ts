import ChatterEntity from "../../Database/Entities/ChatterEntity";
import Setting, {Integer, SettingType} from "../Settings/Setting";
import SettingsSystem from "../Settings/SettingsSystem";
import Message from "../../Chat/Message";
import System from "../System";
import EntityStateList from "../../Database/EntityStateList";
import {logError} from "../../Utilities/Logger";


export default class StrikeManager extends System {
    private static STRIKE_1 = new Setting("filter.strike.1", 1 as Integer, SettingType.INTEGER);
    private static STRIKE_2 = new Setting("filter.strike.2", 600 as Integer, SettingType.INTEGER);
    private static STRIKE_3 = new Setting("filter.strike.3", 28800 as Integer, SettingType.INTEGER);
    private static STRIKEOUT = new Setting("filter.strikeout", -1 as Integer, SettingType.INTEGER);
    private strikes: EntityStateList<ChatterEntity, number> = new EntityStateList<ChatterEntity, number>(0);

    constructor() {
        super("StrikeManager");

        const settings = SettingsSystem.getInstance();
        settings.registerSetting(StrikeManager.STRIKE_1);
        settings.registerSetting(StrikeManager.STRIKE_2);
        settings.registerSetting(StrikeManager.STRIKE_3);
        settings.registerSetting(StrikeManager.STRIKEOUT);

        this.logger.info("System initialized");
    }

    public async issueStrike(type: string, message: Message) {
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
                const length = await channel.getSetting(StrikeManager.STRIKEOUT);
                const strikeoutReason = await response.translate("filter:strikeout", {reason: banReason});
                if (length < 0)
                    await adapter.banChatter(chatter, strikeoutReason);
                else
                    await adapter.tempbanChatter(chatter, length, strikeoutReason);
                this.logger.info(`Final strike issued for the user ${chatter.name} in the channel ${chatter.getChannel().name}, reason: ${banReason}`)
            } else {
                await response.message("filter:strike", {username: chatter.name, reason, number: strike});
                const length = await chatter.getChannel().getSetting<SettingType.INTEGER>(`filter.strike.${strike}`);
                if (length > 0) await adapter.tempbanChatter(chatter, length, banReason);
                this.logger.info(`Strike ${strike} issued for the user ${chatter.name} in the channel ${chatter.getChannel().name}, reason: ${banReason}`)
            }
        } catch (e) {
            logError(this.logger, e, "Unable to ban user while issuing strike");
        }
    }

    public pardonUser(chatter: ChatterEntity) {
        this.strikes.set(chatter, 0);
    }
}