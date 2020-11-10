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
import { Channel } from "../../Database/Entities/Channel";
import { Chatter } from "../../Database/Entities/Chatter";
import { ChatterRepository } from "../../Database/Repositories/ChatterRepository";
import { InjectRepository } from "typeorm-typedi-extensions";
import { Service } from "typedi";
import { ChatterManager } from "../../Chat/ChatterManager";
import Event from "../../Systems/Event/Event";

@Service()
export default class TwitchAdapter extends Adapter {
    public static readonly serviceName = "twitch";
    public static readonly LOGGER = getLogger("Twitch");

    public client: tmi.Client;
    public oldApi: kraken.Api;

    constructor(
        private readonly channelManager: ChannelManager,
        private readonly chatterManager: ChatterManager,
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
            const event = new Event(MessageEvent);
            event.extra.put(MessageEvent.EXTRA_MESSAGE, msg);
            this.eventSystem.dispatch(event);
        });

        this.client.on("join", async (channelName: string, username: string, self: boolean) => {
            if (self) {
                await this.getChannelByName(channelName.substring(1));
                return;
            }

            const channel = await this.getChannelByName(channelName.substring(1));
            const chatter = await this.getChatter(username, channel);

            this.chatterManager.setActive(chatter, true);
            const event = new Event(JoinEvent);
            event.extra.put(JoinEvent.EXTRA_CHANNEL, channel);
            event.extra.put(JoinEvent.EXTRA_CHATTER, chatter);
            this.eventSystem.dispatch(event);
        });

        this.client.on("part", async (channelName: string, username: string, self: boolean) => {
            if (self) return;

            const channel = await this.getChannelByName(channelName.substring(1));
            const chatter = await this.getChatter(username, channel);

            this.chatterManager.setActive(chatter, false);
            const event = new Event(LeaveEvent);
            event.extra.put(LeaveEvent.EXTRA_CHANNEL, channel);
            event.extra.put(LeaveEvent.EXTRA_CHATTER, chatter);
            this.eventSystem.dispatch(event);
        });

        this.client.on("connected", () => {
            this.eventSystem.dispatch(new Event(ConnectedEvent));
        });

        this.client.on("disconnected", (reason: string) => {
            const event = new Event(DisconnectedEvent);
            event.extra.put(DisconnectedEvent.EXTRA_REASON, reason);
            this.eventSystem.dispatch(event);
        });

        await this.client.connect();
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
        const event = new Event(NewChatterEvent);
        event.extra.put(NewChatterEvent.EXTRA_CHATTER, chatter);
        this.eventSystem.dispatch(event);
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
        const event = new Event(NewChannelEvent);
        event.extra.put(NewChannelEvent.EXTRA_CHANNEL, channel);
        this.eventSystem.dispatch(event);
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