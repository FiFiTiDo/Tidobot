import AbstractModule, {Symbols} from "./AbstractModule";
import MessageEvent from "../Chat/Events/MessageEvent";
import {array_rand, tuple} from "../Utilities/ArrayUtils";
import ChannelEntity from "../Database/Entities/ChannelEntity";
import ChatterEntity from "../Database/Entities/ChatterEntity";
import Message from "../Chat/Message";
import PermissionSystem from "../Systems/Permissions/PermissionSystem";
import {Role} from "../Systems/Permissions/Role";
import Permission from "../Systems/Permissions/Permission";
import Setting, {Float, Integer, SettingType} from "../Systems/Settings/Setting";
import {EventArguments} from "../Systems/Event/Event";
import {EventHandler, HandlesEvents} from "../Systems/Event/decorators";
import Command from "../Systems/Commands/Command";
import {CommandEventArgs} from "../Systems/Commands/CommandEvent";
import {string} from "../Systems/Commands/Validator/String";
import {ValidatorStatus} from "../Systems/Commands/Validator/Strategies/ValidationStrategy";
import StandardValidationStrategy from "../Systems/Commands/Validator/Strategies/StandardValidationStrategy";
import {getLogger} from "../Utilities/Logger";
import {command, Subcommand} from "../Systems/Commands/decorators";
import {permission} from "../Systems/Permissions/decorators";
import {setting} from "../Systems/Settings/decorators";
import EntityStateList from "../Database/EntityStateList";

export const MODULE_INFO = {
    name: "Raffle",
    version: "1.0.1",
    description: "Run a raffle to randomly select users from the chat who entered the specified keyword"
};

const logger = getLogger(MODULE_INFO.name);

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
    private userEntries: EntityStateList<ChatterEntity, number>;
    private entries: string[];
    private winners: string[];

    constructor(private readonly keyword: string, private channel: ChannelEntity, private settings: RaffleSettings) {
        this.userEntries = new EntityStateList<ChatterEntity, number>(0);
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
        if (this.userEntries.get(chatter) >= this.settings.maxEntries) return false;

        return PermissionSystem.getInstance().check("raffle.enter", chatter, roles);
    }

    addEntry(chatter: ChatterEntity): void {
        this.userEntries.set(chatter, this.userEntries.get(chatter) + 1);
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
        this.userEntries.filter((id, entity) => !entity.getChannel().is(this.channel));
        this.entries = [];
        this.winners = [];
    }
}

class RaffleCommand extends Command {
    constructor(private readonly raffleModule: RaffleModule) {
        super("raffle", "<open|close|reset|pull>");
    }

    @Subcommand("open")
    async open({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "raffle open [keyword]",
            subcommand: "open",
            arguments: tuple(
                string({ name: "entry phrase", required: true, greedy: true})
            ),
            permission: this.raffleModule.openRaffle
        }));
         if (status !== ValidatorStatus.OK) return;
        const [keyword] = args;

        if (this.raffleModule.raffles.has(msg.getChannel())) {
            if (this.raffleModule.raffles.get(msg.getChannel()).isOpen()) {
                await response.message("raffle:error.already-open");
                return;
            }
        }

        const raffle = new Raffle(keyword, msg.getChannel(), {
            price: await msg.getChannel().getSetting(this.raffleModule.price),
            maxEntries: await msg.getChannel().getSetting(this.raffleModule.maxEntries),
            duplicateWins: await msg.getChannel().getSetting(this.raffleModule.duplicateWins)
        });
        raffle.open();
        await response.message("raffle:opened", {keyword});
    }

    @Subcommand("close")
    async close({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {status} = await event.validate(new StandardValidationStrategy({
            usage: "raffle close",
            subcommand: "close",
            permission: this.raffleModule.closeRaffle
        }));
        const raffle = await this.getRaffle(msg, RaffleState.OPEN);
        if (status !== ValidatorStatus.OK || raffle === null) return;

        raffle.close();
        await response.message("raffle:closed");
    }

    @Subcommand("reset")
    async reset({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {status} = await event.validate(new StandardValidationStrategy({
            usage: "raffle reset",
            subcommand: "reset",
            permission: this.raffleModule.resetRaffle
        }));
        const raffle = await this.getRaffle(msg);
        if (status !== ValidatorStatus.OK || raffle === null) return;

        raffle.reset();
        await response.message("raffle:reset");
    }

    @Subcommand("pull", "draw")
    async pull({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {status} = await event.validate(new StandardValidationStrategy({
            usage: "raffle pull",
            subcommand: "pull",
            permission: this.raffleModule.pullWinner
        }));
        const raffle = await this.getRaffle(msg);
        if (status !== ValidatorStatus.OK || raffle === null) return;

        const winner = raffle.pullWinner();
        if (winner === null) {
            await response.message("raffle:error.no-entries");
            return;
        }

        await response.message("raffle:pull-lead-up");
        setTimeout(() => msg.getResponse().message("@" + winner + "!!!"), 1000);
    }

    private async getRaffle(msg: Message, state: RaffleState = RaffleState.OPEN | RaffleState.CLOSED): Promise<Raffle | null> {
        if (!this.raffleModule.raffles.has(msg.getChannel())) {
            await msg.getResponse().message("raffle:error.no-recent");
            return null;
        }

        const raffle = this.raffleModule.raffles.get(msg.getChannel());
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
    static [Symbols.ModuleInfo] = MODULE_INFO;
    readonly raffles: EntityStateList<ChannelEntity, Raffle>;

    constructor() {
        super(RaffleModule);

        this.raffles = new EntityStateList<ChannelEntity, Raffle>(null);
    }

    @command raffleCommand = new RaffleCommand(this);

    @permission openRaffle = new Permission("raffle.open", Role.MODERATOR);
    @permission closeRaffle = new Permission("raffle.close", Role.MODERATOR);
    @permission resetRaffle = new Permission("raffle.reset", Role.MODERATOR);
    @permission pullWinner = new Permission("raffle.pull", Role.MODERATOR);
    @permission enterRaffle = new Permission("raffle.enter", Role.NORMAL);

    @setting price = new Setting("raffle.price", 0.0 as Float, SettingType.FLOAT);
    @setting maxEntries = new Setting("raffle.max-entries", 1 as Integer, SettingType.INTEGER);
    @setting duplicateWins = new Setting("raffle.duplicate-wins", false, SettingType.BOOLEAN);

    @EventHandler(MessageEvent)
    async handleMessage({event}: EventArguments<MessageEvent>): Promise<void> {
        const msg = event.getMessage();
        const channel = msg.getChannel();
        const sender = msg.getChatter();

        if (this.isDisabled(channel)) return;
        if (!this.raffles.has(channel)) return;
        const raffle = this.raffles.get(channel);

        if (msg.getRaw().toLowerCase() === raffle.getKeyword().toLowerCase())
            if (await raffle.canEnter(sender, await msg.getUserRoles()))
                raffle.addEntry(sender);
    }
}