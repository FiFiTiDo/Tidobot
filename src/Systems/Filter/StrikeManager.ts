import ChatterEntity, {ChatterStateList} from "../../Database/Entities/ChatterEntity";
import Setting, {SettingType} from "../Settings/Setting";
import SettingsSystem from "../Settings/SettingsSystem";
import Message from "../../Chat/Message";
import System from "../System";


export default class StrikeManager extends System {
    private strikes: ChatterStateList<number> = new ChatterStateList<number>(0);

    constructor() {
        super("StrikeManager");

        const settings = SettingsSystem.getInstance();
        settings.registerSetting(new Setting("filter.strike.1", "0", SettingType.INTEGER));
        settings.registerSetting(new Setting("filter.strike.2", "600", SettingType.INTEGER));
        settings.registerSetting(new Setting("filter.strike.3", "28800", SettingType.INTEGER));
        settings.registerSetting(new Setting("filter.strikeout", "-1", SettingType.INTEGER));

        this.logger.info("System initialized");
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
                this.logger.info(`Final strike issued for the user ${chatter.name} in the channel ${chatter.getChannel().name}, reason: ${banReason}`)
            } else {
                await response.message("filter:strike", {username: chatter.name, reason, number: strike});
                const length = await chatter.getChannel().getSetting<number>(`filter.strike.${strike}`);
                if (length > 0)
                    await adapter.tempbanChatter(chatter, length, banReason);
                this.logger.info(`Strike ${strike} issued for the user ${chatter.name} in the channel ${chatter.getChannel().name}, reason: ${banReason}`)
            }
        } catch (e) {
            this.logger.error("Unable to ban user while issuing strike");
            this.logger.trace("Caused by: " + e.message);
        }
    }

    public pardonUser(chatter: ChatterEntity) {
        this.strikes.setChatter(chatter, 0);
    }
}