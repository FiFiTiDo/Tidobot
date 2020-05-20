import AbstractModule from "./AbstractModule";
import MessageEvent from "../Chat/Events/MessageEvent";
import {array_rand} from "../Utilities/ArrayUtils";
import ChannelEntity, {ChannelStateList} from "../Database/Entities/ChannelEntity";
import ChatterEntity, {ChatterStateList} from "../Database/Entities/ChatterEntity";
import Message from "../Chat/Message";
import PermissionSystem from "../Systems/Permissions/PermissionSystem";
import {Role} from "../Systems/Permissions/Role";
import Permission from "../Systems/Permissions/Permission";
import Setting, {SettingType} from "../Systems/Settings/Setting";
import SettingsSystem from "../Systems/Settings/SettingsSystem";
import {EventArguments} from "../Systems/Event/Event";
import {EventHandler, HandlesEvents} from "../Systems/Event/decorators";
import Command from "../Systems/Commands/Command";
import {CommandEventArgs} from "../Systems/Commands/CommandEvent";
import CommandSystem from "../Systems/Commands/CommandSystem";
import {string} from "../Systems/Commands/Validator/String";
import {ValidatorStatus} from "../Systems/Commands/Validator/CommandEventValidator";

enum RaffleState {
    OPEN = 1,
    CLOSED = 1 << 1
}

interface RaffleSettings {
    price: number;
    maxEntries: number;
    duplicateWins: boolean;
}

class Raffle {
    private state: RaffleState;
    private userEntries: ChatterStateList<number>;
    private entries: string[];
    private winners: string[];

    constructor(private readonly keyword: string, private channel: ChannelEntity, private settings: RaffleSettings) {
        this.userEntries = new ChatterStateList<number>(0);
        this.state = RaffleState.CLOSED;
        this.reset();
    }

    getKeyword(): string {
        return this.keyword;
    }

    open(): void {
        this.state = RaffleState.OPEN;
    }

    close(): void {
        this.state = RaffleState.CLOSED;
    }

    isOpen(): boolean {
        return this.state === RaffleState.OPEN;
    }

    getState(): RaffleState {
        return this.state;
    }

    async canEnter(chatter: ChatterEntity, roles: Role[]): Promise<boolean> {
        if (!this.isOpen()) return false;
        if (this.userEntries.getChatter(chatter) >= this.settings.maxEntries) return false;

        return PermissionSystem.getInstance().check("raffle.enter", chatter, roles);
    }

    addEntry(chatter: ChatterEntity): void {
        this.userEntries.setChatter(chatter, this.userEntries.getChatter(chatter) + 1);
        this.entries.push(chatter.name);
    }

    pullWinner(): string | null {
        if (this.entries.length < 1) return null;
        if (this.winners.length === Object.keys(this.userEntries).length && !this.settings.duplicateWins) return null;
        let winner;
        do {
            winner = array_rand(this.entries);
        } while (this.winners.indexOf(winner) >= 0 && !this.settings.duplicateWins);
        this.winners.push(winner);
        return winner;
    }

    reset(): void {
        this.userEntries.clear(this.channel);
        this.entries = [];
        this.winners = [];
    }
}

class RaffleCommand extends Command {
    constructor(private raffles: ChannelStateList<Raffle>) {
        super("raffle", "<open|close|reset|pull>");

        this.addSubcommand("open", this.open);
        this.addSubcommand("close", this.close);
        this.addSubcommand("reset", this.reset);
        this.addSubcommand("pull", this.pull);
    }

    async open({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate({
            usage: "raffle open [keyword]",
            arguments: [
                string({ name: "entry phrase", required: true, greedy: true})
            ],
            permission: "raffle.open"
        });
         if (status !== ValidatorStatus.OK) return;
        const [keyword] = args as [string];

        if (this.raffles.hasChannel(msg.getChannel())) {
            if (this.raffles.getChannel(msg.getChannel()).isOpen()) {
                await response.message("raffle:error.already-open");
                return;
            }
        }

        const raffle = new Raffle(keyword, msg.getChannel(), {
            price: await msg.getChannel().getSettings().get("raffles.price"),
            maxEntries: await msg.getChannel().getSettings().get("raffles.max-entries"),
            duplicateWins: await msg.getChannel().getSettings().get("raffles.max-entries")
        });
        raffle.open();
        await response.message("raffle:opened", {keyword});
    }

    async close({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "raffle close",
            permission: "raffle.close"
        });
        const raffle = await this.getRaffle(msg, RaffleState.OPEN);
        if (args === null || raffle === null) return;

        raffle.close();
        await response.message("raffle:closed");
    }

    async reset({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "raffle reset",
            permission: "raffle.reset"
        });
        const raffle = await this.getRaffle(msg);
        if (args === null || raffle === null) return;

        raffle.reset();
        await response.message("raffle:reset");
    }

    async pull({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "raffle pull",
            permission: "raffle.pull"
        });
        const raffle = await this.getRaffle(msg);
        if (args === null || raffle === null) return;

        const winner = raffle.pullWinner();
        if (winner === null) {
            await response.message("raffle:error.no-entries");
            return;
        }

        await response.message("raffle:pull-lead-up");
        setTimeout(() => msg.getResponse().message("@" + winner + "!!!"), 1000);
    }

    private async getRaffle(msg: Message, state: RaffleState = RaffleState.OPEN | RaffleState.CLOSED): Promise<Raffle | null> {
        if (!this.raffles.hasChannel(msg.getChannel())) {
            await msg.getResponse().message("raffle:error.no-recent");
            return null;
        }

        const raffle = this.raffles.getChannel(msg.getChannel());
        if (raffle.getState() & state) {
            return raffle;
        } else {
            if ((state & RaffleState.OPEN) === RaffleState.OPEN) {
                await msg.getResponse().message("raffle:error.not-open");
            } else if ((state & RaffleState.CLOSED) === RaffleState.CLOSED) {
                await msg.getResponse().message("raffle:error.already-open");
            }
            return null;
        }
    }
}

@HandlesEvents()
export default class RaffleModule extends AbstractModule {
    private readonly raffles: ChannelStateList<Raffle>;

    constructor() {
        super(RaffleModule.name);

        this.raffles = new ChannelStateList<Raffle>(null);
    }

    initialize(): void {
        const cmd = CommandSystem.getInstance();
        cmd.registerCommand(new RaffleCommand(this.raffles), this);

        const perm = PermissionSystem.getInstance();
        perm.registerPermission(new Permission("raffle.open", Role.MODERATOR));
        perm.registerPermission(new Permission("raffle.close", Role.MODERATOR));
        perm.registerPermission(new Permission("raffle.reset", Role.MODERATOR));
        perm.registerPermission(new Permission("raffle.pull", Role.MODERATOR));
        perm.registerPermission(new Permission("raffle.enter", Role.NORMAL));

        const settings = SettingsSystem.getInstance();
        settings.registerSetting(new Setting("raffle.price", "0.0", SettingType.FLOAT));
        settings.registerSetting(new Setting("raffle.max-entries", "1", SettingType.INTEGER));
        settings.registerSetting(new Setting("raffle.duplicate-wins", "false", SettingType.BOOLEAN));
    }

    @EventHandler(MessageEvent)
    async handleMessage({event}: EventArguments<MessageEvent>): Promise<void> {
        const msg = event.getMessage();
        if (this.isDisabled(msg.getChannel())) return;
        if (!this.raffles.hasChannel(msg.getChannel())) return;
        const raffle = this.raffles.getChannel(msg.getChannel());

        if (msg.getRaw().toLowerCase() === raffle.getKeyword().toLowerCase())
            if (await raffle.canEnter(msg.getChatter(), await msg.getUserRoles()))
                raffle.addEntry(msg.getChatter());
    }
}