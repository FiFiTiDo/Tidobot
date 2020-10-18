import { Service } from "typedi";
import { EntityRepository, Repository } from "typeorm";
import { Channel } from "../Entities/Channel";
import { Permission } from "../Entities/Permission";

@Service()
@EntityRepository(Permission)
export class PermissionRepository extends Repository<Permission> {
    findByToken(token: string, channel: Channel) {
        return this.findOne({ token, channel });
    }

    removeByChannel(channel: Channel) {
        return this.remove(channel.permissions)
    }
}