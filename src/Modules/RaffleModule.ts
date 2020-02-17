import AbstractModule from "./AbstractModule";
import CommandModule, {CommandEvent, SubcommandHelper} from "./CommandModule";
import PermissionModule, {PermissionLevel} from "./PermissionModule";
import MessageEvent from "../Chat/Events/MessageEvent";
import Dispatcher from "../Event/Dispatcher";
import Chatter from "../Chat/Chatter";
import Channel from "../Chat/Channel";
import Application from "../Application/Application";
import {__, array_rand} from "../Utilities/functions";
import SettingsModule from "./SettingsModule";
import {StringToBooleanConverter, StringToFloatConverter, StringToIntegerConverter} from "../Utilities/Converter";

export default class RaffleModule extends AbstractModule {
    private raffles: Map<string, Raffle>;

    constructor() {
        super(RaffleModule.name);

        this.raffles = new Map();
    }

    initialize() {
        const cmd = this.getModuleManager().getModule(CommandModule);
        cmd.registerCommand("raffle", this.raffleCommand, this);

        const perm = this.getModuleManager().getModule(PermissionModule);
        perm.registerPermission("raffle.open", PermissionLevel.MODERATOR);
        perm.registerPermission("raffle.close", PermissionLevel.MODERATOR);
        perm.registerPermission("raffle.reset", PermissionLevel.MODERATOR);
        perm.registerPermission("raffle.pull", PermissionLevel.MODERATOR);
        perm.registerPermission("raffle.enter", PermissionLevel.NORMAL);

        const settings = this.getModuleManager().getModule(SettingsModule);
        settings.registerSetting("raffle.price", "0.0", StringToFloatConverter.func);
        settings.registerSetting("raffle.max-entries", "1", StringToIntegerConverter.func);
        settings.registerSetting("raffle.duplicate-wins", "false", StringToBooleanConverter.func);
    }

    registerListeners(dispatcher: Dispatcher) {
        dispatcher.addListener(MessageEvent, this.messageHandler);
    }

    unregisterListeners(dispatcher: Dispatcher) {
        dispatcher.removeListener(MessageEvent, this.messageHandler);
    }

    messageHandler = async (event: MessageEvent) => {
        let msg = event.getMessage();
        if (this.isDisabled(msg.getChannel())) return;
        if (!this.raffles.has(msg.getChannel().getId())) return;
        let raffle = this.raffles.get(msg.getChannel().getId());

        if (msg.getRaw().toLowerCase() === raffle.getKeyword().toLowerCase())
            if (await raffle.canEnter(msg.getChatter(), await msg.getUserLevels()))
                raffle.addEntry(msg.getChatter());
    };

    async raffleCommand(event: CommandEvent) {
        new SubcommandHelper.Builder()
            .addSubcommand("open", this.open)
            .addSubcommand("close", this.close)
            .addSubcommand("reset", this.reset)
            .addSubcommand("pull", this.pull)
            .build(this)
            .handle(event);
    }

    async open(event: CommandEvent) {
        let msg = event.getMessage();
        let args = await event.validate({
            usage: "raffle open [keyword]",
            arguments: [
                {
                    type: "string",
                    required: true
                },
                {
                    type: "string",
                    required: true,
                    greedy: true
                }
            ],
            permission: "raffle.open"
        });
        if (args === null) return;

        if (this.raffles.has(msg.getChannel().getId())) {
            if (this.raffles.get(msg.getChannel().getId()).isOpen()) {
                await msg.reply(__("raffles.open.already_open"));
                return;
            }
        }

        let raffle = new Raffle(args[1], msg.getChannel(), {
            price: await msg.getChannel().getSettings().get("raffles.price"),
            max_entries: await msg.getChannel().getSettings().get("raffles.max-entries"),
            duplicate_wins: await msg.getChannel().getSettings().get("raffles.max-entries")
        });
        raffle.open();
        await msg.reply(__("raffles.open.successful", args[1]));
    };

    async close(event: CommandEvent) {
        let msg = event.getMessage();
        let args = await event.validate({
            usage: "raffle close",
            permission: "raffle.close"
        });
        if (args === null) return;

        if (!this.raffles.has(msg.getChannel().getId())) {
            await msg.reply(__("raffles.does_not_exist"));
            return;
        }

        let raffle = this.raffles.get(msg.getChannel().getId());

        if (!raffle.isOpen()) {
            await msg.reply(__("raffle.close.not_open"));
            return;
        }

        raffle.close();
        await msg.reply(__("raffle.close.successful"));
    };

    async reset(event: CommandEvent) {
        let msg = event.getMessage();
        let args = await event.validate({
            usage: "raffle reset",
            permission: "raffle.reset"
        });
        if (args === null) return;

        if (!this.raffles.has(msg.getChannel().getId())) {
            await msg.reply(__("raffles.does_not_exist"));
            return;
        }

        let raffle = this.raffles.get(msg.getChannel().getId());
        raffle.reset();
        await msg.reply(__("raffle.reset.successful"));
    };

    async pull(event: CommandEvent) {
        let msg = event.getMessage();
        let args = await event.validate({
            usage: "raffle pull",
            permission: "raffle.pull"
        });
        if (args === null) return;

        if (!this.raffles.has(msg.getChannel().getId())) {
            await msg.reply(__("raffles.does_not_exist"));
            return;
        }

        let raffle = this.raffles.get(msg.getChannel().getId());
        let winner = raffle.pullWinner();
        if (winner === null) {
            await msg.reply(__("raffle.pull.failed"));
            return;
        }

        await msg.reply(__("raffle.pull.lead_up"));
        setTimeout(() => {
            msg.reply("@" + winner + "!!!");
        }, 1000);
    };
}

interface RaffleSettings {
    price: number,
    max_entries: number,
    duplicate_wins: boolean
}

class Raffle {
    private _open: boolean;
    private readonly keyword: string;
    private user_entries: { [key: string]: number };
    private entries: string[];
    private winners: string[];
    private channel: Channel;
    private settings: RaffleSettings;

    constructor(keyword: string, channel: Channel, settings: RaffleSettings) {
        this.keyword = keyword;
        this.channel = channel;
        this.settings = settings;

        this.reset();
    }

    getKeyword() {
        return this.keyword;
    }

    open() {
        this._open = true;
    }

    close() {
        this._open = false;
    }

    isOpen() {
        return this._open;
    }

    async canEnter(chatter: Chatter, permission_levels: PermissionLevel[]) {
        if (!this.isOpen()) return false;
        if (this.user_entries.hasOwnProperty(chatter.getId()))
            if (this.user_entries[chatter.getId()] >= this.settings.max_entries) return false;

        return await Application.getModuleManager().getModule(PermissionModule).checkPermission("raffle.enter", chatter, permission_levels);
    }

    addEntry(chatter: Chatter) {
        if (!this.user_entries.hasOwnProperty(chatter.getId()))
            this.user_entries[chatter.getId()] = 0;
        this.user_entries[chatter.getId()]++;
        this.entries.push(chatter.getName());
    }

    pullWinner(): string | null {
        if (this.entries.length < 1) return null;
        if (this.winners.length === Object.keys(this.user_entries).length && !this.settings.duplicate_wins) return null;
        let winner;
        do {
            winner = array_rand(this.entries);
        } while (this.winners.indexOf(winner) >= 0 && !this.settings.duplicate_wins);
        this.winners.push(winner);
        return winner;
    }

    reset() {
        this.user_entries = {};
        this.entries = [];
        this.winners = [];
    }
}