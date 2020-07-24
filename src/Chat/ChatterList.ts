import ChatterEntity from "../Database/Entities/ChatterEntity";
import {MapExt} from "../Utilities/Structures/Map";
import Optional from "../Utilities/Patterns/Optional";

export default class ChatterList {
    private readonly chatters: MapExt<string, ChatterEntity>;

    constructor() {
        this.chatters = new MapExt<string, ChatterEntity>();
    }

    has(chatter: ChatterEntity): boolean {
        return this.chatters.has(chatter.userId);
    }

    add(chatter: ChatterEntity): boolean {
        if (this.has(chatter)) return false;
        this.chatters.set(chatter.userId, chatter);
        return true;
    }

    remove(chatter: ChatterEntity): boolean {
        return this.chatters.delete(chatter.userId);
    }

    getAll(): ChatterEntity[] {
        return [...this.chatters.values()];
    }

    findById(id: string): Optional<ChatterEntity> {
        return Optional.ofUndefable(this.getAll().find(chatter => chatter.userId === id));
    }

    findByName(name: string): Optional<ChatterEntity> {
        return Optional.ofUndefable(this.getAll().find(chatter => chatter.name === name));
    }
}