import { Service } from "typedi";
import { InjectRepository } from "typeorm-typedi-extensions";
import { Chatter } from "../Database/Entities/Chatter";
import { ChatterRepository } from "../Database/Repositories/ChatterRepository";
import { Role } from "../Systems/Permissions/Role";
import { MapExt } from "../Utilities/Structures/Map";

interface ChatterState {
    active: boolean;
    roles: Role[];
}

@Service()
export class ChatterManager {
    private chatterState: MapExt<number, ChatterState> = new MapExt();

    constructor(
        @InjectRepository()
        private readonly repository: ChatterRepository
    ) {}

    public getState(chatter: Chatter): ChatterState {
        return this.chatterState.getOrSet(chatter.id, {
            active: false,
            roles: []
        });
    }

    public isActive(chatter: Chatter): boolean {
        return this.getState(chatter).active;
    }
    
    public setActive(chatter: Chatter, active: boolean): void {
        this.getState(chatter).active = active;
    }

    public addRole(chatter: Chatter, role: Role): void {
        this.getState(chatter).roles.push(role);
    }

    public removeRole(chatter: Chatter, role: Role): void {
        const roles = this.getState(chatter).roles;
        const i = roles.findIndex(other => other === role);
        delete roles[i];
    }

    public save(chatter: Chatter): Promise<Chatter> {
        return this.repository.save(chatter);
    }
}