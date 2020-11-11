import { Service } from "typedi";
import { EntityRepository } from "typeorm";
import { Channel } from "../Entities/Channel";
import { Permission } from "../Entities/Permission";
import { ConvertingRepository } from "./ConvertingRepository";

@Service()
@EntityRepository(Permission)
export class PermissionRepository extends ConvertingRepository<Permission> {
    static TYPE = "permission"

    convert(raw: string, channel: Channel): Promise<Permission> {
        return this.findByToken(raw, channel);
    }

    findByToken(token: string, channel: Channel): Promise<Permission> {
        return this.findOne({ token, channel });
    }

    removeByChannel(channel: Channel): Promise<Permission[]> {
        return this.find({ channel }).then(permissions => this.remove(permissions));
    }
}