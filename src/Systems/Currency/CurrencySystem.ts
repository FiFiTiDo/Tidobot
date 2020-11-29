import { Service } from "typedi";
import { ChatterManager } from "../../Chat/ChatterManager";
import { Channel } from "../../Database/Entities/Channel";
import System from "../System";

@Service()
export class CurrencySystem extends System {
    constructor(private readonly chatterManager: ChatterManager) {
        super("Currency");
    }

    async giveAll(channel: Channel, amount: number, active = false): Promise<void> {
        const chatters = active ? 
            this.chatterManager.getAllActive(channel) :
            this.chatterManager.getAll(channel);
        
        await Promise.all(chatters.map(chatter => chatter.deposit(amount)));
    }

    async takeAll(channel: Channel, amount: number, active = false): Promise<void> {
        const chatters = active ? 
            this.chatterManager.getAllActive(channel) :
            this.chatterManager.getAll(channel);

        await Promise.all(chatters.map(chatter => chatter.withdraw(amount)));
    }

    async resetChannel(channel: Channel): Promise<void> {
        await Promise.all(this.chatterManager.getAll(channel).map(chatter => chatter.resetBalance()));
    }
}