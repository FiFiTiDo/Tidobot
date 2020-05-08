import Entity, {EntityParameters} from "./Entity";
import ChannelEntity from "./ChannelEntity";

interface ChannelEntityParameters extends EntityParameters {
    channel?: ChannelEntity
}

export default class ChannelSpecificEntity<T extends ChannelSpecificEntity<T>> extends Entity<T> {
    getChannel(): ChannelEntity | null {
        return this.params.channel as ChannelEntity|undefined || null;
    }

    static normalizeParameters(params: ChannelEntityParameters): ChannelEntityParameters {
        if (params.channel) params.service = params.channel.getService();
        return params;
    }
}