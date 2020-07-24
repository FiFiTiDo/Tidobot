import EntityStateList from "../Database/EntityStateList";
import ChatterEntity, {filterByChannel} from "../Database/Entities/ChatterEntity";
import ChannelEntity from "../Database/Entities/ChannelEntity";
import BettingModule from "../Modules/BettingModule";

export enum PlaceBetResponse {
    INVALID_OPTION, LOW_BALANCE, TOO_LOW, TOO_HIGH, BET_PLACED
}

class BettingGame {
    private readonly bets: Map<string, EntityStateList<ChatterEntity, number>>;
    private open: boolean;

    constructor(private bettingModule: BettingModule, private readonly title: string, private readonly channel: ChannelEntity, options: string[]) {

        this.bets = new Map();
        this.open = true;

        for (const option of options)
            this.bets.set(option.toLowerCase(), new EntityStateList<ChatterEntity, number>(0));
    }

    getTitle(): string {
        return this.title;
    }

    async close(winningOption: string): Promise<number | null> {
        if (!this.bets.has(winningOption.toLowerCase())) return null;
        this.open = false;

        const bets = this.bets.get(winningOption.toLowerCase());
        const winnings = Math.ceil(this.getGrandTotal() / bets.size(filterByChannel(this.channel)));
        for (const [chatter] of bets.getAll(filterByChannel(this.channel))) await chatter.deposit(winnings);
        return winnings;
    }

    async place(option: string, amount: number, chatter: ChatterEntity): Promise<PlaceBetResponse> {
        option = option.toLowerCase();
        if (!this.bets.has(option)) return PlaceBetResponse.INVALID_OPTION;
        const bets = this.bets.get(option);

        let value = 0;
        if (bets.has(chatter)) value = bets.get(chatter);
        value += amount;

        const min = await chatter.getChannel().getSetting(this.bettingModule.minimumBet);
        const max = await chatter.getChannel().getSetting(this.bettingModule.maximumBet);
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
            for (const [, value] of bets.getAll(filterByChannel(this.channel))) total += value;
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

export class BetService {
    private betInstances: EntityStateList<ChannelEntity, BettingGame>;

    constructor(private bettingModule: BettingModule) {
        this.betInstances = new EntityStateList<ChannelEntity, BettingGame>(null);
    }

    public getGame(channel: ChannelEntity): BettingGame | null {
        if (!this.betInstances.has(channel)) return null;
        return this.betInstances.get(channel);
    }

    public placeBet(chatter: ChatterEntity, option: string, amount: number, channel: ChannelEntity): Promise<PlaceBetResponse | null> {
        const game = this.getGame(channel);
        if (!game?.isOpen()) return null;
        return game.place(option, amount, chatter);
    }

    public openBet(title: string, options: string[], channel: ChannelEntity): boolean {
        let game = this.getGame(channel);
        if (game !== null && game.isOpen()) return null;
        game = new BettingGame(this.bettingModule, title, channel, options);
        this.betInstances.set(channel, game);
        return true;
    }

    public async getTotals(channel: ChannelEntity): Promise<GameTotals | null> {
        const game = this.getGame(channel);
        if (game === null) return null;
        return {
            optionTotals: [...game.getTotals()],
            grandTotal: game.getGrandTotal()
        };
    }
}