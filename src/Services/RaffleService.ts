import {Role} from "../Systems/Permissions/Role";
import Optional from "../Utilities/Patterns/Optional";
import Message from "../Chat/Message";
import { Chatter } from "../Database/Entities/Chatter";
import { EntityStateList } from "../Database/EntityStateList";
import { Channel } from "../Database/Entities/Channel";
import { Service } from "typedi";
import PermissionSystem from "../Systems/Permissions/PermissionSystem";
import _ from "lodash";

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
    private userEntries: EntityStateList<Chatter, number>;
    private entries: string[];
    private winners: string[];

    constructor(
        readonly keyword: string, private channel: Channel, 
        private settings: RaffleSettings, private readonly raffleService: RaffleService
    ) {
        this.userEntries = new EntityStateList<Chatter, number>(0);
        this.state = RaffleState.CLOSED;
        this.reset();
    }

    get keywordLower(): string {
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

    async canEnter(chatter: Chatter, roles: Role[]): Promise<boolean> {
        if (!this.isOpen()) return false;
        if (this.userEntries.get(chatter) >= this.settings.maxEntries) return false;

        return this.raffleService.permissionSystem.check("raffle.enter", chatter, roles);
    }

    addEntry(chatter: Chatter): void {
        this.userEntries.set(chatter, this.userEntries.get(chatter) + 1);
        this.entries.push(chatter.user.name);
    }

    pullWinner(): string | null {
        if (this.entries.length < 1) return null;
        if (this.winners.length === Object.keys(this.userEntries).length && !this.settings.duplicateWins) return null;
        let winner;
        do {
            winner = _.sample(this.entries);
        } while (this.winners.indexOf(winner) >= 0 && !this.settings.duplicateWins);
        this.winners.push(winner);
        return winner;
    }

    reset(): void {
        this.userEntries.filter((id, entity) => !entity.channel.is(this.channel));
        this.entries = [];
        this.winners = [];
    }
}

@Service()
export class RaffleService {
    readonly raffles: EntityStateList<Channel, Raffle> = new EntityStateList<Channel, Raffle>(null);

    constructor(public readonly permissionSystem: PermissionSystem) {
    }

    getRaffle(channel: Channel): Optional<Raffle> {
        return Optional.ofNullable(this.raffles.get(channel));
    }

    getOpenRaffle(channel: Channel): Optional<Raffle> {
        return this.getRaffle(channel).filter(raffle => raffle.isOpen());
    }

    openRaffle(keyword: string, channel: Channel, settings: RaffleSettings): Optional<Raffle> {
        if (this.getOpenRaffle(channel)) return Optional.empty();

        const raffle = new Raffle(keyword, channel, settings, this);
        raffle.open();
        this.raffles.set(channel, raffle);
        return Optional.of(raffle);
    }

    closeRaffle(channel: Channel): Optional<void> {
        return this.getOpenRaffle(channel).map(raffle => raffle.close());
    }

    resetRaffle(channel: Channel): Optional<void> {
        return this.getRaffle(channel).map(raffle => raffle.reset());
    }

    pullWinner(channel: Channel): Optional<string | false> {
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
        });
    }
}