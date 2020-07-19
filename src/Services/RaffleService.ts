import EntityStateList from "../Database/EntityStateList";
import ChatterEntity from "../Database/Entities/ChatterEntity";
import ChannelEntity from "../Database/Entities/ChannelEntity";
import {Role} from "../Systems/Permissions/Role";
import PermissionSystem from "../Systems/Permissions/PermissionSystem";
import {array_rand} from "../Utilities/ArrayUtils";
import Optional from "../Utilities/Optional";
import Message from "../Chat/Message";

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

    constructor(readonly keyword: string, private channel: ChannelEntity, private settings: RaffleSettings) {
        this.userEntries = new EntityStateList<ChatterEntity, number>(0);
        this.state = RaffleState.CLOSED;
        this.reset();
    }

    get keywordLower() {
        return this.keyword.toLowerCase();
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

export class RaffleService {
    readonly raffles: EntityStateList<ChannelEntity, Raffle> = new EntityStateList<ChannelEntity, Raffle>(null);

    getRaffle(channel: ChannelEntity): Optional<Raffle> {
        return Optional.ofNullable(this.raffles.get(channel));
    }

    getOpenRaffle(channel: ChannelEntity): Optional<Raffle> {
        return this.getRaffle(channel).filter(raffle => raffle.isOpen());
    }

    getClosedRaffle(channel: ChannelEntity): Optional<Raffle> {
        return this.getRaffle(channel).filter(raffle => !raffle.isOpen());
    }

    openRaffle(keyword: string, channel: ChannelEntity, settings: RaffleSettings): Optional<Raffle> {
        if (this.getOpenRaffle(channel)) return Optional.empty();

        const raffle = new Raffle(keyword, channel, settings);
        raffle.open();
        this.raffles.set(channel, raffle);
        return Optional.of(raffle);
    }

    closeRaffle(channel: ChannelEntity): Optional<void> {
        return this.getOpenRaffle(channel).map(raffle => raffle.close());
    }

    resetRaffle(channel: ChannelEntity): Optional<void> {
        return this.getRaffle(channel).map(raffle => raffle.reset());
    }

    pullWinner(channel: ChannelEntity): Optional<string|false> {
        return this.getRaffle(channel).map(raffle => raffle.pullWinner() ?? false);
    }

    async tryEnter(message: Message): Promise<Optional<boolean>> {
        const sender = message.getChatter();
        const roles = await message.getUserRoles();
        const raw = message.getRaw().toLowerCase();

        return this.getOpenRaffle(message.getChannel()).map(raffle => {
            if (raw !== raffle.keywordLower || !raffle.canEnter(sender, roles)) return false;
            raffle.addEntry(sender);
            return true;
        })
    }
}