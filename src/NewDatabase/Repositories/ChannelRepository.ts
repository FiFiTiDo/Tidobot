import { Service } from "typedi";
import { EntityRepository, Repository } from "typeorm";
import { Channel } from "../Entities/Channel";
import { Service as ServiceEntity } from "../Entities/Service";

@Service()
@EntityRepository(Channel)
export class ChannelRepository extends Repository<Channel> {
    findByNativeId(nativeId: string, service: ServiceEntity) {
        return this.findOne({ nativeId, service });
    }
}