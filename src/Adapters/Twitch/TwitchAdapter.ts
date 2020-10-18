import Adapter, {AdapterOptions} from "../Adapter";
import * as tmi from "tmi.js";
import {helix, kraken} from "./TwitchApi";
import MessageEvent from "../../Chat/Events/MessageEvent";
import {TwitchMessage} from "./TwitchMessage";
import ConnectedEvent from "../../Chat/Events/ConnectedEvent";
import DisconnectedEvent from "../../Chat/Events/DisconnectedEvent";
import JoinEvent from "../../Chat/Events/JoinEvent";
import LeaveEvent from "../../Chat/Events/LeaveEvent";
import Config from "../../Systems/Config/Config";
import EventSystem from "../../Systems/Event/EventSystem";
import ChannelManager from "../../Chat/ChannelManager";
import {NewChannelEvent} from "../../Chat/Events/NewChannelEvent";
import TwitchConfig from "../../Systems/Config/ConfigModels/TwitchConfig";
import {getLogger, logError} from "../../Utilities/Logger";
import {NewChatterEvent} from "../../Chat/Events/NewChatterEvent";
import GeneralConfig from "../../Systems/Config/ConfigModels/GeneralConfig";
import { Channel } from "../../NewDatabase/Entities/Channel";
import { Chatter } from "../../NewDatabase/Entities/Chatter";
import { ChatterRepository } from "../../NewDatabase/Repositories/ChatterRepository";
import { InjectRepository } from "typeorm-typedi-extensions";
import { Service } from "typedi";

@Service()
export default class TwitchAdapter extends Adapter {
    public static readonly serviceName = "twitch";
    public static readonly LOGGER = getLogger("Twitch");

    public client: tmi.Client;
    public oldApi: kraken.Api;

    constructor(
        private readonly channelManager: ChannelManager,
        @InjectRepository()
        private readonly chatterRepository: ChatterRepository,
        public readonly api: helix.Api,
        private readonly config: Config,
        private readonly eventSystem: EventSystem
    ) {
        super();
    }

    async run(options: AdapterOptions): Promise<void> {
        const config = await this.config.getConfig(TwitchConfig);
        const general = await this.config.getConfig(GeneralConfig);
        this.api.setCredentials(config.api.clientId, config.api.clientSecret);
        this.oldApi = new kraken.Api(config.api.clientId);
        this.client = tmi.Client({
            identity: config.identities[options.identity] || config.identities["default"],
            channels: general.channels
        });

        this.client.on("message", async (channelName: string, userstate: tmi.ChatUserstate, message: string, self: boolean) => {
            if (self) return;

            const channel = await this.getChannelByName(channelName.substring(1));
            const chatter = await this.getChatter(userstate, channel);

            const msg = new TwitchMessage(message, chatter, channel, userstate, this);

            this.eventSystem.dispatch(new MessageEvent(msg));
        });

        this.client.on("join", async (channelName: string, username: string, self: boolean) => {
            if (self) {
                await this.getChannelByName(channelName.substring(1));
                return;
            }

            const channel = await this.getChannelByName(channelName.substring(1));
            const chatter = await this.getChatter(username, channel);

            channel.addChatter(chatter);
            this.eventSystem.dispatch(new JoinEvent(chatter, channel));
        });

        this.client.on("part", async (channelName: string, username: string, self: boolean) => {
            if (self) return;

            const channel = await this.getChannelByName(channelName.substring(1));
            const chatter = await this.getChatter(username, channel);

            channel.removeChatter(chatter);
            this.eventSystem.dispatch(new LeaveEvent(chatter, channel));
        });

        this.client.on("connected", (server: string, port: number) => {
            const event = new ConnectedEvent();
            event.setMetadata({server, port});

            this.eventSystem.dispatch(event);
        });

        this.client.on("disconnected", (reason: string) => {
            const event = new DisconnectedEvent();
            event.setMetadata({reason});

            this.eventSystem.dispatch(event);
        });

        await this.client.connect();
        super.run(options);
    }

    async stop(): Promise<void> {
        await this.client.disconnect();
    }

    async sendMessage(message: string, channel: Channel): Promise<void> {
        await this.client.say(channel.name, message);
    }

    async sendAction(action: string, channel: Channel): Promise<void> {
        await this.client.action(channel.name, action);
    }

    async getChatter(user: string | tmi.Userstate, channel: Channel): Promise<Chatter> {
        const chatterOptional = typeof user === "string" ? 
            channel.findChatterByName(user) : channel.findChatterByNativeId(user.id);
        if (chatterOptional.present) return chatterOptional.value;

        let id: string, name: string;
        if (typeof user !== "string") {
            id = user["user-id"];
            name = user.username;
        } else {
            try {
                const resp = await this.api.getUsers({login: user});
                id = resp.data[0].id;
                name = user;
            } catch (e) {
                logError(TwitchAdapter.LOGGER, e, "Unable to retrieve user from the API", true);
                process.exit(1);
            }
        }


        const chatter = await this.chatterRepository.make(id, name, channel);
        this.eventSystem.dispatch(new NewChatterEvent(chatter));
        return chatter;
    }

    async getChannelByName(channelName: string): Promise<Channel> {
        const channelOptional = await this.channelManager.findByName(channelName);

        if (channelOptional.present) return channelOptional.value;

        let resp: helix.Response<helix.User>;
        try {
            resp = await this.api.getUsers({login: channelName});
        } catch (e) {
            logError(TwitchAdapter.LOGGER, e, "Unable to retrieve user from the API", true);
            process.exit(1);
        }
        const {id, login: name} = resp.data[0];

        const channel = new Channel();
        channel.name = name;
        channel.nativeId = id;
        await this.channelManager.save(channel);
        this.eventSystem.dispatch(new NewChannelEvent(channel));
        return channel;
    }

    async unbanChatter(chatter: Chatter): Promise<boolean> {
        try {
            await this.client.unban(chatter.channel.name, chatter.user.name);
            return true;
        } catch (e) {
            logError(TwitchAdapter.LOGGER, e, "Tried to unban chatter " + chatter.user.name + " but was unable to");
            return false;
        }
    }

    async banChatter(chatter: Chatter, reason?: string): Promise<boolean> {
        try {
            await this.client.ban(chatter.channel.name, chatter.user.name, reason);
            return true;
        } catch (e) {
            logError(TwitchAdapter.LOGGER, e, "Tried to ban chatter " + chatter.user.name + " but was unable to");
            return false;
        }
    }

    async tempbanChatter(chatter: Chatter, length: number, reason?: string): Promise<boolean> {
        try {
            await this.client.timeout(chatter.channel.name, chatter.user.name, length, reason);
            return true;
        } catch (e) {
            logError(TwitchAdapter.LOGGER, e, "Tried to time out chatter " + chatter.user.name + " but was unable to");
            return false;
        }
    }

    getName(): string {
        return "twitch";
    }
}