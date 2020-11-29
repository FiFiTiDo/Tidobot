import { Service } from "typedi";
import { EntityRepository, Repository } from "typeorm";
import { InjectRepository } from "typeorm-typedi-extensions";
import { PermissionLike } from "../../Utilities/Interfaces/PermissionLike";
import { Channel } from "../Entities/Channel";
import { Group } from "../Entities/Group";
import { GroupPermission } from "../Entities/GroupPermission";
import { ConvertingRepository } from "./ConvertingRepository";

@Service()
@EntityRepository(Group)
export class GroupRepository extends ConvertingRepository<Group> {
    static TYPE = "group"

    constructor(@InjectRepository(GroupPermission) private readonly groupPermissionRepository: Repository<GroupPermission>) {
        super();
    }

    convert(raw: string, channel: Channel): Promise<Group> {
        return this.findOne({ name: raw, channel });
    }

    async updatePermission(group: Group, permission: PermissionLike, granted: boolean): Promise<GroupPermission> {
        for (const groupPermission of group.permissions) {
            if (groupPermission.permission.token === permission.token) {
                groupPermission.granted = granted;
                return groupPermission.save();
            }
        }
        
        return this.groupPermissionRepository.create({ group, permission, granted }).save();
    }

    async removePermission(group: Group, permission: PermissionLike): Promise<GroupPermission|null> {
        for (const groupPermission of group.permissions) {
            if (groupPermission.permission.token === permission.token) {
                return groupPermission.remove();
            }
        }
        return null;
    }

    async removeAllPermissions(group: Group): Promise<GroupPermission[]> {
        return this.groupPermissionRepository.remove(group.permissions);
    }
}