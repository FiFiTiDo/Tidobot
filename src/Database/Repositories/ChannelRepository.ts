import Container, { Service } from "typedi";
import { EntityRepository, Repository } from "typeorm";
import { Channel } from "../Entities/Channel";
import { InjectRepository } from "typeorm-typedi-extensions";
import { ChannelSettings } from "../Entities/ChannelSettings";
import { ServiceToken } from "../../symbols";

@Service()
@EntityRepository(Channel)
export class ChannelRepository extends Repository<Channel> {
    constructor(
        @InjectRepository(ChannelSettings) 
        private readonly channelSettingsRepository: Repository<ChannelSettings>
    ) {
        super();
    }

    findByNativeId(nativeId: string): Promise<Channel> {
        const service = Container.get(ServiceToken);
        return this.findOne({ nativeId, service });
    }

    async make(name: string, nativeId: string): Promise<Channel> {
        let channel = new Channel();
        channel.name = name;
        channel.nativeId = nativeId;
        channel.service = Container.get(ServiceToken);
        channel = await this.save(channel);

        let channelSettings = new ChannelSettings();
        channelSettings.json = {};
        channelSettings.channel = channel;
        channelSettings = await this.channelSettingsRepository.save(channelSettings);

        channel.settings = channelSettings;
        return channel.save();
    }
}