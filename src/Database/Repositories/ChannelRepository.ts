import { Service } from "typedi";
import { DeepPartial, EntityRepository, Repository } from "typeorm";
import { Channel } from "../Entities/Channel";
import { InjectRepository } from "typeorm-typedi-extensions";
import { ChannelSettings } from "../Entities/ChannelSettings";
import Event from "../../Systems/Event/Event";
import EventSystem from "../../Systems/Event/EventSystem";
import { NewChannelEvent } from "../../Chat/Events/NewChannelEvent";

@Service()
@EntityRepository(Channel)
export class ChannelRepository extends Repository<Channel> {
    constructor(
        @InjectRepository(ChannelSettings) 
        private readonly channelSettingsRepository: Repository<ChannelSettings>,
        private readonly eventSystem: EventSystem
    ) {
        super();
    }

    async make(entityLike: DeepPartial<Channel>): Promise<Channel> {
        const channel = await this.create(entityLike).save();
        const channelSettings = await this.channelSettingsRepository.create({ json: {}, channel }).save();
        channel.settings = channelSettings;

        const event = new Event(NewChannelEvent);
        event.extra.put(NewChannelEvent.EXTRA_CHANNEL, channel);
        this.eventSystem.dispatch(event);

        return channel;
    }
}