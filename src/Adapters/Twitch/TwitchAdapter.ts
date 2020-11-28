import Adapter, {AdapterOptions} from "../Adapter";
import * as tmi from "tmi.js";
import {helix} from "./TwitchApi";
import MessageEvent from "../../Chat/Events/MessageEvent";
import {TwitchMessage} from "./TwitchMessage";
import ConnectedEvent from "../../Chat/Events/ConnectedEvent";
import DisconnectedEvent from "../../Chat/Events/DisconnectedEvent";
import JoinEvent from "../../Chat/Events/JoinEvent";
import LeaveEvent from "../../Chat/Events/LeaveEvent";
import Config from "../../Systems/Config/Config";
import EventSystem from "../../Systems/Event/EventSystem";
import ChannelManager from "../../Chat/ChannelManager";
import TwitchConfig from "../../Systems/Config/ConfigModels/TwitchConfig";
import {getLogger, logError} from "../../Utilities/Logger";
import { Channel } from "../../Database/Entities/Channel";
import { ChatterRepository } from "../../Database/Repositories/ChatterRepository";
import { InjectRepository } from "typeorm-typedi-extensions";
import { Service } from "typedi";
import { ChatterManager } from "../../Chat/ChatterManager";
import Event from "../../Systems/Event/Event";
import { TwitchUserAdapter } from "./TwitchUserAdapter";
import { TwitchChannelAdapter } from "./TwitchChannelAdapter";
import { User } from "../../Database/Entities/User";

@Service()
export default class TwitchAdapter extends Adapter {
    public static readonly serviceName = "twitch";
    public static readonly LOGGER = getLogger("Twitch");

    public client: tmi.Client;
    private _connectedChannels: string[] = [];

    constructor(
        private readonly channelManager: ChannelManager,
        private readonly chatterManager: ChatterManager,
        private readonly userAdapter: TwitchUserAdapter,
        private readonly channelAdapter: TwitchChannelAdapter,
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
        this.api.setCredentials(config.api.clientId, config.api.clientSecret);
        this.client = tmi.Client({
            identity: config.identities[options.identity] || config.identities["default"],
            channels: config.channels
        });
        this._connectedChannels = config.channels;
        this.channelManager.setActive(this.connectedChannels);

        this.client.on("message", async (channelName: string, userstate: tmi.ChatUserstate, message: string, self: boolean) => {
            if (self) return;

            const channel = await this.channelAdapter.getChannel(channelName.substring(1));
            const user = await this.userAdapter.getUser(userstate);
            const chatter = await this.chatterRepository.retreiveOrMake(user, channel);

            const msg = new TwitchMessage(message, chatter, channel, userstate, this);
            const event = new Event(MessageEvent);
            event.extra.put(MessageEvent.EXTRA_MESSAGE, msg);
            this.eventSystem.dispatch(event);
        });

        this.client.on("join", async (channelName: string, username: string, self: boolean) => {
            if (self) {
                await this.channelAdapter.getChannel(channelName.substring(1));
                return;
            }

            const channel = await this.channelAdapter.getChannel(channelName.substring(1));
            const user = await this.userAdapter.getUser(username);
            const chatter = await this.chatterRepository.retreiveOrMake(user, channel);

            this.chatterManager.setActive(chatter, true);
            const event = new Event(JoinEvent);
            event.extra.put(JoinEvent.EXTRA_CHANNEL, channel);
            event.extra.put(JoinEvent.EXTRA_CHATTER, chatter);
            this.eventSystem.dispatch(event);
        });

        this.client.on("part", async (channelName: string, username: string, self: boolean) => {
            if (self) return;

            const channel = await this.channelAdapter.getChannel(channelName.substring(1));
            const user = await this.userAdapter.getUser(username);
            const chatter = await this.chatterRepository.retreiveOrMake(user, channel);

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
        try {
            await this.client.say(channel.name, message);
        } catch(e) {
            logError(TwitchAdapter.LOGGER, e, "Unable to send message");
        }
    }

    async broadcastMessage(message: string): Promise<void> {
        const ops = [];
        for (const channel of await this.channelManager.getAllActive())
            ops.push(this.sendMessage(message, channel));
        await Promise.all(ops);
    }

    async sendAction(action: string, channel: Channel): Promise<void> {
        try {
            await this.client.action(channel.name, action);
        } catch(e) {
            logError(TwitchAdapter.LOGGER, e, "Unable to send action");
        }
    }

    async unbanChatter(user: User, channel: Channel): Promise<boolean> {
        try {
            await this.client.unban(channel.name, user.name);
            return true;
        } catch (e) {
            logError(TwitchAdapter.LOGGER, e, "Tried to unban chatter " + user.name + " but was unable to");
            return false;
        }
    }

    async banChatter(user: User, channel: Channel, reason?: string): Promise<boolean> {
        try {
            await this.client.ban(channel.name,user.name, reason);
            return true;
        } catch (e) {
            logError(TwitchAdapter.LOGGER, e, "Tried to ban chatter " + user.name + " but was unable to");
            return false;
        }
    }

    async tempbanChatter(user: User, channel: Channel, length: number, reason?: string): Promise<boolean> {
        try {
            await this.client.timeout(channel.name, user.name, length, reason);
            return true;
        } catch (e) {
            logError(TwitchAdapter.LOGGER, e, "Tried to time out chatter " + user.name + " but was unable to");
            return false;
        }
    }

    get name(): string {
        return "twitch";
    }

    get connectedChannels(): string[] {
        return this._connectedChannels;
    }
}