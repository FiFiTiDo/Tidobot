import BettingModule from "../Modules/BettingModule";
import { EntityStateList } from "../Database/EntityStateList";
import { Chatter } from "../Database/Entities/Chatter";
import { Channel } from "../Database/Entities/Channel";
import { Service } from "typedi";

export enum PlaceBetResponse {
    INVALID_OPTION, LOW_BALANCE, TOO_LOW, TOO_HIGH, BET_PLACED
}

class BettingGame {
    private readonly bets: Map<string, EntityStateList<Chatter, number>>;
    private open: boolean;

    constructor(private readonly title: string, options: string[]) {

        this.bets = new Map();
        this.open = true;

        for (const option of options)
            this.bets.set(option.toLowerCase(), new EntityStateList<Chatter, number>(0));
    }

    getTitle(): string {
        return this.title;
    }

    async close(winningOption: string): Promise<number | null> {
        if (!this.bets.has(winningOption.toLowerCase())) return null;
        this.open = false;

        const bets = this.bets.get(winningOption.toLowerCase());
        const winnings = Math.ceil(this.getGrandTotal() / bets.size());
        for (const [chatter] of bets.getAll()) await chatter.deposit(winnings);
        return winnings;
    }

    async place(option: string, amount: number, chatter: Chatter): Promise<PlaceBetResponse> {
        option = option.toLowerCase();
        if (!this.bets.has(option)) return PlaceBetResponse.INVALID_OPTION;
        const bets = this.bets.get(option);

        let value = 0;
        if (bets.has(chatter)) value = bets.get(chatter);
        value += amount;

        const min = chatter.channel.settings.get(BettingModule.settings.minimumBet);
        const max = chatter.channel.settings.get(BettingModule.settings.maximumBet);
        if (value < min && min >= 0 && min <= max) return PlaceBetResponse.TOO_LOW;
        if (value > max && max > 0) return PlaceBetResponse.TOO_HIGH;

        if (chatter.balance < amount) return PlaceBetResponse.LOW_BALANCE;

        await chatter.charge(amount);
        bets.set(chatter, value);
        return PlaceBetResponse.BET_PLACED;
    }

    * getTotals(): Generator<[string, number]> {
        for (const [option, bets] of this.bets.entries()) {
            let total = 0;
            for (const [, value] of bets.getAll()) total += value;
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

interface GameTotals {
    optionTotals: [string, number][];
    grandTotal: number;
}

@Service()
export class BetService {
    private betInstances: EntityStateList<Channel, BettingGame>;

    constructor() {
        this.betInstances = new EntityStateList<Channel, BettingGame>(null);
    }

    public getGame(channel: Channel): BettingGame | null {
        if (!this.betInstances.has(channel)) return null;
        return this.betInstances.get(channel);
    }

    public placeBet(chatter: Chatter, option: string, amount: number): Promise<PlaceBetResponse | null> {
        const game = this.getGame(chatter.channel);
        if (!game?.isOpen()) return null;
        return game.place(option, amount, chatter);
    }

    public openBet(title: string, options: string[], channel: Channel): boolean {
        let game = this.getGame(channel);
        if (game !== null && game.isOpen()) return null;
        game = new BettingGame(title, options);
        this.betInstances.set(channel, game);
        return true;
    }

    public async getTotals(channel: Channel): Promise<GameTotals | null> {
        const game = this.getGame(channel);
        if (game === null) return null;
        return {
            optionTotals: [...game.getTotals()],
            grandTotal: game.getGrandTotal()
        };
    }
}