import ChatterEntity from "../Database/Entities/ChatterEntity";

export default class ChatterList {
    private readonly chatters: ChatterEntity[];

    constructor() {
        this.chatters = [];
    }

    has(chatter: ChatterEntity): boolean {
        for (const chatter2 of this.chatters)
            if (chatter.is(chatter2))
                return true;
        return false;
    }

    add(chatter: ChatterEntity): boolean {
        if (this.has(chatter)) return false;
        this.chatters.push(chatter);
        return true;
    }

    remove(chatter: ChatterEntity): boolean {
        for (let i = 0; i < this.chatters.length; i++) {
            const chatter2 = this.chatters[i];
            if (chatter.is(chatter2)) {
                this.chatters[chatter.getChannel().channelId].splice(i, 1);
                return true;
            }
        }
        return false;
    }

    getAll(): ChatterEntity[] {
        return this.chatters;
    }

    findById(id: string) {
        for (const chatter of this.chatters)
            if (chatter.userId === id)
                return chatter;
        return null;
    }

    findByName(name: string): ChatterEntity|null {
        for (const chatter of this.chatters)
            if (chatter.name.toLowerCase() === name.toLowerCase())
                return chatter;
        return null;
    }
}