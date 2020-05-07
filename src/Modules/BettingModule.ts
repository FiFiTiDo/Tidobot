import AbstractModule from "./AbstractModule";
import CommandModule, {Command, CommandEventArgs} from "./CommandModule";
import CurrencyModule from "./CurrencyModule";
import ChatterEntity, {ChatterStateList} from "../Database/Entities/ChatterEntity";
import ChannelEntity, {ChannelStateList} from "../Database/Entities/ChannelEntity";
import {Key} from "../Utilities/Translator";
import ModuleManager from "./ModuleManager";
import PermissionSystem from "../Systems/Permissions/PermissionSystem";
import Permission from "../Systems/Permissions/Permission";
import {Role} from "../Systems/Permissions/Role";
import Logger from "../Utilities/Logger";
import SettingsSystem from "../Systems/Settings/SettingsSystem";
import Setting, {SettingType} from "../Systems/Settings/Setting";
import {objectHasProperties} from "../Utilities/ObjectUtils";

enum PlaceBetResponse {
    INVALID_OPTION, LOW_BALANCE, TOO_LOW, TOO_HIGH, BET_PLACED
}

class BettingGame {

    private readonly bets: Map<string, ChatterStateList<number>>;
    private open: boolean;

    constructor(private readonly title: string, private readonly channel: ChannelEntity, options: string[]) {

        this.bets = new Map();
        this.open = true;

        for (const option of options)
            this.bets.set(option.toLowerCase(), new ChatterStateList<number>(0));
    }

    getTitle(): string {
        return this.title;
    }

    async close(winningOption: string): Promise<number|null> {
        if (!objectHasProperties(this.bets, winningOption.toLowerCase())) return null;
        this.open = false;

        for (const [option, bets] of this.bets.entries()) {
            if (option === winningOption.toLowerCase()) {
                const winnings = Math.ceil(this.getGrandTotal() / bets.size(this.channel));
                for (const [chatter] of bets.entries(this.channel)) await chatter.deposit(winnings);
                return winnings;
            }
        }
    }

    async place(option: string, amount: number, chatter: ChatterEntity): Promise<PlaceBetResponse> {
        option = option.toLowerCase();
        if (!this.bets.has(option)) return PlaceBetResponse.INVALID_OPTION;
        const bets = this.bets.get(option);

        let value = 0;
        if (bets.hasChatter(chatter)) value = bets.getChatter(chatter);
        value += amount;

        const min = await chatter.getChannel().getSettings().get("bet.minimum");
        const max = await chatter.getChannel().getSettings().get("bet.maximum");
        if (value < min && min >= 0 && min <= max) return PlaceBetResponse.TOO_LOW;
        if (value > max && max > 0) return PlaceBetResponse.TOO_HIGH;

        if (chatter.balance < amount) return PlaceBetResponse.LOW_BALANCE;

        await chatter.charge(amount);
        bets.setChatter(chatter, value);
        return PlaceBetResponse.BET_PLACED;
    }

    *getTotals(): Generator<[string, number]> {
        for (const [option, bets] of this.bets.entries()) {
            let total = 0;
            for (const [, value] of bets.entries(this.channel)) total += value;
            yield [option, total];
        }
    }

    getGrandTotal(): number {
        let total = 0;
        for (const [, subtotal] of this.getTotals()) total += subtotal;
        return total;
    }

    isOpen(): boolean {
        return this.open;
    }
}

class BetCommand extends Command {
    private betInstances: ChannelStateList<BettingGame>;

    constructor(private moduleManager: ModuleManager) {
        super("bet", "<place|open|close|check>");

        this.betInstances = new ChannelStateList<BettingGame>(null);

        this.addSubcommand("place", this.place);
        this.addSubcommand("open", this.open);
        this.addSubcommand("close", this.close);
        this.addSubcommand("check", this.check);
    }

    async place({ event, message: msg, response }: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "bet place <option #> <amount>",
            arguments: [
                {
                    value: {
                        type: "integer",
                    },
                    required: true
                },
                {
                    value: {
                        type: "integer",
                    },
                    required: true
                }
            ],
            permission: "bet.place"
        });
        if (args === null) return;
        const [, option, amount] = args;

        if (!this.betInstances.hasChannel(msg.getChannel())) return;
        const game = this.betInstances.getChannel(msg.getChannel());
        if (!game.isOpen()) return;

        try {
            const resp = await game.place(option, amount, msg.getChatter());
            switch (resp) {
                case PlaceBetResponse.INVALID_OPTION:
                    await response.message(Key("betting.place.invalid_option"));
                    break;
                case PlaceBetResponse.LOW_BALANCE:
                    await response.message(Key("betting.place.low_balance"), await this.moduleManager.getModule(CurrencyModule).getPluralName(msg.getChannel()));
                    break;
                case PlaceBetResponse.TOO_LOW:
                    await response.message(Key("betting.place.too_low"));
                    break;
                case PlaceBetResponse.TOO_HIGH:
                    await response.message(Key("betting.place.too_high"));
                    break;
                case PlaceBetResponse.BET_PLACED:
                    await response.message(Key("betting.place.placed"), await this.moduleManager.getModule(CurrencyModule).formatAmount(amount, msg.getChannel()), option);
                    break;
            }
        } catch (e) {
            await response.message(Key("betting.place.failed"));
            Logger.get().error("Failed to place the bet", { cause: e });
        }
    }

    async open({ event, message: msg, response }: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "bet open \"<title>\" <option 1> <option 2> ... <option n>",
            arguments: [
                {
                    value: {
                        type: "string"
                    },
                    specialString: true,
                    required: true
                },
                {
                    value: {
                        type: "string"
                    },
                    required: true,
                    array: true
                }
            ],
            permission: "bet.open"
        });
        if (args === null) return;
        const [, title, options] = args;

        if (this.betInstances.hasChannel(msg.getChannel()) && this.betInstances.getChannel(msg.getChannel()).isOpen())
            return response.message(Key("betting.open.already_open"));

        const game = new BettingGame(title, msg.getChannel(), options);
        this.betInstances.setChannel(msg.getChannel(), game);
        await response.message(Key("betting.open.successful"), title, options.join(", "));
    }

    async close({ event, message: msg, response }: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "bet close <winning option>",
            arguments: [
                {
                    value: {
                        type: "string"
                    },
                    required: true
                }
            ],
            permission: "bet.close"
        });
        if (args === null) return;
        const [, option] = args;

        if (!this.betInstances.hasChannel(msg.getChannel()) || !this.betInstances.getChannel(msg.getChannel()).isOpen())
            return response.message(Key("betting.closed.not_open"));

        const game = this.betInstances.getChannel(msg.getChannel());
        const winnings = await game.close(option);

        if (winnings === null)
            return response.message(Key("betting.closed.invalid_option"));
        else
            return response.message(Key("betting.close.successful"), game.getTitle(), option, await this.moduleManager.getModule(CurrencyModule).formatAmount(winnings, msg.getChannel()));
    }

    async check({ event, message: msg, response }: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "bet check",
            permission: "bet.check"
        });
        if (args === null) return;

        if (!this.betInstances.hasChannel(msg.getChannel()))
            return response.message(Key("betting.check.no_recent"));

        const game = this.betInstances.getChannel(msg.getChannel());
        const grandTotal = game.getGrandTotal();
        const parts = [];
        for (const [option, total] of game.getTotals())
            parts.push(response.getTranslator().translate("betting.check.part", option, await this.moduleManager.getModule(CurrencyModule).formatAmount(total, msg.getChannel()), (total / grandTotal) * 100));
        await response.message(Key("betting.check.current_stats"), parts.join("; "));
    }
}

export default class BettingModule extends AbstractModule {
    constructor() {
        super(BettingModule.name);
    }

    initialize(): void {
        const cmd = this.moduleManager.getModule(CommandModule);
        cmd.registerCommand(new BetCommand(this.moduleManager), this);

        const perm = PermissionSystem.getInstance();
        perm.registerPermission(new Permission("bet.place", Role.NORMAL));
        perm.registerPermission(new Permission("bet.open", Role.MODERATOR));
        perm.registerPermission(new Permission("bet.close", Role.MODERATOR));
        perm.registerPermission(new Permission("bet.check", Role.MODERATOR));

        const settings = SettingsSystem.getInstance();
        settings.registerSetting(new Setting("bet.minimum", "1", SettingType.INTEGER));
        settings.registerSetting(new Setting("bet.maximum", "-1", SettingType.INTEGER));
    }
}