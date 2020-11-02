import { Service } from "typedi";
import { EntityRepository, Repository } from "typeorm";
import Permission from "../../Systems/Permissions/Permission";
import { Chatter } from "../Entities/Chatter";
import { ChatterPermission } from "../Entities/ChatterPermission";

@Service()
@EntityRepository(ChatterPermission)
export class ChatterPermissionRepoistory extends Repository<ChatterPermission> {
    async updatePermission(chatter: Chatter, permission: Permission, granted: boolean): Promise<ChatterPermission> {
        for (const ChatterPermission of chatter.permissions) {
            if (ChatterPermission.permission.token === permission.token) {
                ChatterPermission.granted = granted;
                return ChatterPermission.save();
            }
        }
        
        return this.create({ chatter, permission, granted }).save();
    }
}