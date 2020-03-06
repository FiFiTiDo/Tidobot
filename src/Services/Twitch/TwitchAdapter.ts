import Adapter, {AdapterOptions} from "../Adapter";
import * as tmi from 'tmi.js'
import {helix, kraken} from "./TwitchApi";
import Application from "../../Application/Application";
import Chatter from "../../Chat/Chatter";
import MessageEvent from "../../Chat/Events/MessageEvent";
import {TwitchMessage} from "./TwitchMessage";
import ConnectedEvent from "../../Chat/Events/ConnectedEvent";
import DisconnectedEvent from "../../Chat/Events/DisconnectedEvent";
import Channel from "../../Chat/Channel";
import JoinEvent from "../../Chat/Events/JoinEvent";
import LeaveEvent from "../../Chat/Events/LeaveEvent";
import moment from "moment";

const cache_length: { length: moment.DurationInputArg1, unit: moment.unitOfTime.DurationConstructor } = Application.getConfig().getOrDefault("general.cache.users");
const cache_expiresAfter = moment.duration(cache_length.length, cache_length.unit);

export default class TwitchAdapter extends Adapter {
    public client: tmi.Client;
    public api: helix.Api;
    public oldApi: kraken.Api;

    constructor() {
        super();

        this.api = new helix.Api(Application.getConfig().getOrDefault("twitch.api.clientId"));
        this.oldApi = new kraken.Api(Application.getConfig().getOrDefault("twitch.api.clientId"));
    }

    async run(options: AdapterOptions) {
        this.client = tmi.Client({
            identity: Application.getConfig().getOrDefault("twitch.identities." + options.identity, Application.getConfig().getOrDefault("twitch.identities.default")),
            channels: options.channels[0] == Application.DEFAULT_CHANNEL ? Application.getConfig().getOrDefault("twitch.defaultChannels") : options.channels
        });

        this.client.on('message', async (channel_name: string, userstate: tmi.ChatUserstate, message: string, self: boolean) => {
            if (self) return;

            let channel = await this.getChannelByName(channel_name.substring(1));
            let chatter = await this.getChatter(userstate, channel);

            Application.getChatterManager().add(chatter);

            this.dispatch(new MessageEvent(new TwitchMessage(message, chatter, channel, userstate, this)));
        });

        this.client.on('join', async (channel_name: string, username: string, self: boolean) => {
            if (self) return;

            let channel = await this.getChannelByName(channel_name.substring(1));
            let chatter = await this.getChatter(username, channel);

            this.dispatch(new JoinEvent(chatter, channel));
        });

        this.client.on('part', async (channel_name: string, username: string, self: boolean) => {
            if (self) return;

            let channel = await this.getChannelByName(channel_name.substring(1));
            let chatter = await this.getChatter(username, channel);

            this.dispatch(new LeaveEvent(chatter, channel));
        });

        this.client.on('connected', (server: string, port: number) => {
            let event = new ConnectedEvent();
            event.setMetadata({server, port});

            this.dispatch(event);
        });

        this.client.on('disconnected', (reason: string) => {
            let event = new DisconnectedEvent();
            event.setMetadata({reason});

            this.dispatch(event);
        });

        await this.client.connect();
        super.run(options);
    }

    async sendMessage(message: string, channel: Channel) {
        return this.client.say(channel.getName(), message);
    }

    async sendAction(action: string, channel: Channel) {
        return this.client.action(channel.getName(), action);
    }

    async getChatter(user: string | tmi.Userstate, channel: Channel): Promise<Chatter> {
        let name = typeof user === "string" ? user : user.username;
        return Application.getCache().retrieveSerializable("channel." + channel.getName() + ".chatter." + name, cache_expiresAfter.asSeconds(), Chatter, async () => {
            let chatter = await Chatter.find(name, channel);

            if (chatter === null) {
                if (typeof user === "string") {
                    let resp;
                    try {
                        resp = await this.api.getUsers({login: name});
                    } catch (e) {
                        Application.getLogger().emerg("Unable to retrieve user from the API", {cause: e});
                        process.exit(1);
                    }
                    chatter = new Chatter(resp.data[0].id, name, channel);
                } else {
                    chatter = new Chatter(user.id, name, channel);
                }
                await chatter.save();
            }

            return chatter;
        });
    }

    async getChannelByName(channel_name: string) {
        return Application.getCache().retrieveSerializable("channel." + channel_name, cache_expiresAfter.asSeconds(), Channel, async () => {
            let channel = await Channel.findByName(channel_name);

            if (channel === null) {
                let resp: helix.IResponse<helix.IUser>;
                try {
                    resp = await this.api.getUsers({login: channel_name});
                } catch (e) {
                    Application.getLogger().emerg("Unable to retrieve user from the API", {cause: e});
                    process.exit(1);
                }
                channel = new Channel(resp.data[0].id, resp.data[0].login);
                await channel.save();
            }

            return channel;
        });
    }

    async unbanChatter(chatter: Chatter) {
        return this.client.unban(chatter.getChannel().getName(), chatter.getName());
    }

    async banChatter(chatter: Chatter, reason?: string) {
        return this.client.ban(chatter.getChannel().getName(), chatter.getName(), reason);
    }

    async tempbanChatter(chatter: Chatter, length: number, reason?: string) {
        return this.client.timeout(chatter.getChannel().getName(), chatter.getName(), length, reason);
    }
}