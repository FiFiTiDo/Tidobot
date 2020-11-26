import { Service } from "typedi";
import { Channel } from "../../Database/Entities/Channel";
import { logError } from "../../Utilities/Logger";
import { ChannelAdapter } from "../ChannelAdapter";
import TwitchAdapter from "./TwitchAdapter";
import { helix } from "./TwitchApi";

@Service()
export class TwitchChannelAdapter extends ChannelAdapter<string> {
    constructor(private readonly api: helix.Api) {
        super();
    }
    
    getChannel(param: string): Promise<Channel> {
        return this.findByName(param).then(optional => optional.orElseAsync(async () => {
            try {
                const resp = await this.api.getUsers({login: param});
                const {id, login: name} = resp.data[0];
                return await this.createChannel(name, id);
            } catch (e) {
                logError(TwitchAdapter.LOGGER, e, "Unable to create new channel", true);
                process.exit(1);
            }
        }));
    }
}