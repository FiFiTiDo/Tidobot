import { Service } from "typedi";
import { EntityRepository, Repository } from "typeorm";
import { Chatter } from "../Entities/Chatter";
import { ChatterPermission } from "../Entities/ChatterPermission";
import { PermissionLike } from "../../Utilities/Interfaces/PermissionLike";

@Service()
@EntityRepository(ChatterPermission)
export class ChatterPermissionRepoistory extends Repository<ChatterPermission> {
    async updatePermission(chatter: Chatter, permission: PermissionLike, granted: boolean): Promise<ChatterPermission> {
        for (const chatterPermission of chatter.permissions) {
            if (chatterPermission.permission.token === permission.token) {
                chatterPermission.granted = granted;
                return chatterPermission.save();
            }
        }
        
        return this.create({ chatter, permission, granted }).save();
    }
}