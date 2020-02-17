import AbstractModule from "./AbstractModule";
import CommandModule, {CommandEvent, SubcommandHelper} from "./CommandModule";
import PermissionModule, {PermissionLevel} from "./PermissionModule";
import SettingsModule from "./SettingsModule";
import {UserStateList} from "../Chat/User";
import Chatter from "../Chat/Chatter";
import Application from "../Application/Application";
import {ChannelStateList} from "../Chat/Channel";
import {__} from "../Utilities/functions";
import CurrencyModule from "./CurrencyModule";
import {StringToIntegerConverter} from "../Utilities/Converter";

export default class BettingModule extends AbstractModule {
    private bet_instances: ChannelStateList<BettingGame>;

    constructor() {
        super(BettingModule.name);

        this.bet_instances = new ChannelStateList<BettingGame>(null);
    }

    initialize() {
        const cmd = this.getModuleManager().getModule(CommandModule);
        cmd.registerCommand("bet", this.betCmd, this);

        const perm = this.getModuleManager().getModule(PermissionModule);
        perm.registerPermission("bet.place", PermissionLevel.NORMAL);
        perm.registerPermission("bet.open", PermissionLevel.MODERATOR);
        perm.registerPermission("bet.close", PermissionLevel.MODERATOR);
        perm.registerPermission("bet.check", PermissionLevel.MODERATOR);

        const settings = this.getModuleManager().getModule(SettingsModule);
        settings.registerSetting("bet.minimum", "1", StringToIntegerConverter.func);
        settings.registerSetting("bet.maximum", "-1", StringToIntegerConverter.func);
    }

    async betCmd(event: CommandEvent) {
        new SubcommandHelper.Builder()
            .addSubcommand("place", this.placeSubCmd)
            .addSubcommand("open", this.openSubCmd)
            .addSubcommand("close", this.closeSubCmd)
            .addSubcommand("check", this.checkSubCmd)
            .build(this)
            .handle(event);
    }

    async placeSubCmd(event: CommandEvent) {
        let msg = event.getMessage();
        let args = await event.validate({
            usage: "bet place <option #> <amount>",
            arguments: [
                {
                    type: "string",
                    required: true
                },
                {
                    type: "integer",
                    required: true
                },
                {
                    type: "integer",
                    required: true
                }
            ],
            permission: "bet.place"
        });
        if (args === null) return;
        let [, option, amount] = args;

        if (!this.bet_instances.hasChannel(msg.getChannel())) return;
        let game = this.bet_instances.getChannel(msg.getChannel());
        if (!game.isOpen()) return;

        try {
            let resp = await game.place(option, amount, msg.getChatter());
            switch (resp) {
                case PlaceBetResponse.INVALID_OPTION:
                    await msg.reply(__("betting.place.invalid_option"));
                    break;
                case PlaceBetResponse.LOW_BALANCE:
                    await msg.reply(__("betting.place.low_balance", await this.getModuleManager().getModule(CurrencyModule).getPluralName(msg.getChannel())));
                    break;
                case PlaceBetResponse.TOO_LOW:
                    await msg.reply(__("betting.place.too_low"));
                    break;
                case PlaceBetResponse.TOO_HIGH:
                    await msg.reply(__("betting.place.too_high"));
                    break;
                case PlaceBetResponse.BET_PLACED:
                    await msg.reply(__("betting.place.placed", await this.getModuleManager().getModule(CurrencyModule).formatAmount(amount, msg.getChannel()), option));
                    break;
            }
        } catch (e) {
            await msg.reply(__("betting.place.failed"));
            Application.getLogger().error("Failed to place the bet", { cause: e });
        }
    }

    async openSubCmd(event: CommandEvent) {
        let msg = event.getMessage();
        let args = await event.validate({
            usage: "bet open \"<title>\" <option 1> <option 2> ... <option n>",
            arguments: [
                {
                    type: "string",
                    required: true
                },
                {
                    type: "special-string",
                    required: true
                },
                {
                    type: "string",
                    required: true,
                    array: true
                }
            ],
            permission: "bet.open"
        });
        if (args === null) return;
        let [, title, options] = args;

        if (this.bet_instances.hasChannel(msg.getChannel()) && this.bet_instances.getChannel(msg.getChannel()).isOpen())
            return msg.reply(__("betting.open.already_open"));

        let game = new BettingGame(title, options);
        this.bet_instances.setChannel(msg.getChannel(), game);
        await msg.reply(__("betting.open.successful", title, options.join(", ")));
    }

    async closeSubCmd(event: CommandEvent) {
        let msg = event.getMessage();
        let args = await event.validate({
            usage: "bet close <winning option>",
            arguments: [
                {
                    type: "string",
                    required: true
                },
                {
                    type: "string",
                    required: true
                }
            ],
            permission: "bet.close"
        });
        if (args === null) return;
        let [, option] = args;

        if (!this.bet_instances.hasChannel(msg.getChannel()) || !this.bet_instances.getChannel(msg.getChannel()).isOpen())
            return msg.reply(__("betting.closed.not_open"));

        let game = this.bet_instances.getChannel(msg.getChannel());
        let winnings = await game.close(option);

        if (winnings === null)
            return msg.reply(__("betting.closed.invalid_option"));
        else
            return msg.reply(__("betting.close.successful", game.getTitle(), option, await this.getModuleManager().getModule(CurrencyModule).formatAmount(winnings, msg.getChannel())));
    }


    async checkSubCmd(event: CommandEvent) {
        let msg = event.getMessage();
        let args = await event.validate({
            usage: "bet check",
            permission: "bet.check"
        });
        if (args === null) return;

        if (!this.bet_instances.hasChannel(msg.getChannel()))
            return msg.reply(__("betting.check.no_recent"));

        let game = this.bet_instances.getChannel(msg.getChannel());
        let grand_total = game.getGrandTotal();
        let parts = [];
        for (let [option, total] of game.getTotals())
            parts.push(__("betting.check.part", option, await this.getModuleManager().getModule(CurrencyModule).formatAmount(total, msg.getChannel()), (total / grand_total) * 100));
        await msg.reply(__("betting.check.current_stats", parts.join("; ")));
    }
}

enum PlaceBetResponse {
    INVALID_OPTION, LOW_BALANCE, TOO_LOW, TOO_HIGH, BET_PLACED
}

class BettingGame {
    private readonly title: string;
    private readonly bets: Map<string, UserStateList<number>>;
    private open: boolean;

    constructor(title: string, options: string[]) {
        this.title = title;
        this.bets = new Map();
        this.open = true;

        for (let option of options)
            this.bets.set(option.toLowerCase(), new UserStateList<number>(0));
    }

    getTitle() {
        return this.title;
    }

    async close(winning_option: string): Promise<number|null> {
        if (!this.bets.hasOwnProperty(winning_option.toLowerCase())) return null;
        this.open = false;

        for (let [option, bets] of this.bets.entries()) {
            if (option === winning_option.toLowerCase()) {
                let winnings = Math.ceil(this.getGrandTotal() / bets.size());
                for (let [user] of bets.entries()) {
                    let chatter = user as Chatter;
                    await chatter.deposit(winnings);
                }
                return winnings;
            }
        }
    }

    async place(option: string, amount: number, chatter: Chatter) {
        option = option.toLowerCase();
        if (!this.bets.has(option)) return PlaceBetResponse.INVALID_OPTION;
        let bets = this.bets.get(option);

        let value = 0;
        if (bets.hasUser(chatter)) value = bets.getUser(chatter);
        value += amount;

        let min = await chatter.getChannel().getSettings().get("bet.minimum");
        let max = await chatter.getChannel().getSettings().get("bet.maximum");
        if (value < min && min >= 0 && min <= max) return PlaceBetResponse.TOO_LOW;
        if (value > max && max > 0) return PlaceBetResponse.TOO_HIGH;

        if (chatter.getBalance() < amount) return PlaceBetResponse.LOW_BALANCE;

        await Application.getModuleManager().getModule(CurrencyModule).charge(chatter, amount);
        bets.setUser(chatter, value);
        return PlaceBetResponse.BET_PLACED;
    }

    *getTotals(): Generator<[string, number]> {
        for (let [option, bets] of this.bets.entries()) {
            let total = 0;
            for (let [, value] of bets.entries()) total += value;
            yield [option, total];
        }
    }

    getGrandTotal() {
        let total = 0;
        for (let [, subtotal] of this.getTotals()) total += subtotal;
        return total;
    }

    isOpen() {
        return this.open;
    }
}