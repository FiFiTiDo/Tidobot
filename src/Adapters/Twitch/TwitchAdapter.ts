import Adapter, {AdapterOptions} from "../Adapter";
import * as tmi from "tmi.js";
import {helix, kraken} from "./TwitchApi";
import Application from "../../Application/Application";
import MessageEvent from "../../Chat/Events/MessageEvent";
import {TwitchMessageFactory} from "./TwitchMessage";
import ConnectedEvent from "../../Chat/Events/ConnectedEvent";
import DisconnectedEvent from "../../Chat/Events/DisconnectedEvent";
import JoinEvent from "../../Chat/Events/JoinEvent";
import LeaveEvent from "../../Chat/Events/LeaveEvent";
import ChatterEntity from "../../Database/Entities/ChatterEntity";
import ChannelEntity from "../../Database/Entities/ChannelEntity";
import Config from "../../Systems/Config/Config";
import {inject, injectable} from "inversify";
import symbols from "../../symbols";
import EventSystem from "../../Systems/Event/EventSystem";
import ChannelManager from "../../Chat/ChannelManager";
import {NewChannelEvent} from "../../Chat/Events/NewChannelEvent";
import TwitchConfig from "../../Systems/Config/ConfigModels/TwitchConfig";
import {getLogger, logError} from "../../Utilities/Logger";

@injectable()
export default class TwitchAdapter extends Adapter {
    public static readonly LOGGER = getLogger("Twitch");

    public client: tmi.Client;
    public api: helix.Api;
    public oldApi: kraken.Api;

    constructor(
        @inject(ChannelManager) private channelManager: ChannelManager,
        @inject(symbols.TwitchMessageFactory) private messageFactory: TwitchMessageFactory
    ) {
        super();
    }

    async run(options: AdapterOptions): Promise<void> {
        const config = await Config.getInstance().getConfig(TwitchConfig);
        this.api = new helix.Api(config.api.clientId, config.api.clientSecret);
        this.oldApi = new kraken.Api(config.api.clientId);
        this.client = tmi.Client({
            identity: config.identities[options.identity] || config.identities["default"],
            channels: options.channels[0] == Application.DEFAULT_CHANNEL ? config.defaultChannels : options.channels
        });

        this.client.on("message", async (channelName: string, userstate: tmi.ChatUserstate, message: string, self: boolean) => {
            if (self) return;

            const channel = await this.getChannelByName(channelName.substring(1));
            const chatter = await this.getChatter(userstate, channel);

            EventSystem.getInstance().dispatch(new MessageEvent(this.messageFactory(message, chatter, channel, userstate)));
        });

        this.client.on("join", async (channelName: string, username: string, self: boolean) => {
            if (self) {
                await this.getChannelByName(channelName.substring(1));
                return;
            }

            const channel = await this.getChannelByName(channelName.substring(1));
            const chatter = await this.getChatter(username, channel);

            channel.addChatter(chatter);
            EventSystem.getInstance().dispatch(new JoinEvent(chatter, channel));
        });

        this.client.on("part", async (channelName: string, username: string, self: boolean) => {
            if (self) return;

            const channel = await this.getChannelByName(channelName.substring(1));
            const chatter = await this.getChatter(username, channel);

            channel.removeChatter(chatter);
            EventSystem.getInstance().dispatch(new LeaveEvent(chatter, channel));
        });

        this.client.on("connected", (server: string, port: number) => {
            const event = new ConnectedEvent();
            event.setMetadata({server, port});

            EventSystem.getInstance().dispatch(event);
        });

        this.client.on("disconnected", (reason: string) => {
            const event = new DisconnectedEvent();
            event.setMetadata({reason});

            EventSystem.getInstance().dispatch(event);
        });

        await this.client.connect();
        super.run(options);
    }

    async stop(): Promise<void> {
        await this.client.disconnect();
    }

    async sendMessage(message: string, channel: ChannelEntity): Promise<[string]> {
        return this.client.say(channel.name, message);
    }

    async sendAction(action: string, channel: ChannelEntity): Promise<[string]> {
        return this.client.action(channel.name, action);
    }

    async getChatter(user: string | tmi.Userstate, channel: ChannelEntity): Promise<ChatterEntity> {
        let chatter = typeof user === "string" ? channel.findChatterByName(user) : channel.findChatterById(user.id);

        if (chatter === null && typeof user !== "string")
            chatter = await ChatterEntity.findById(user.id, channel);

        if (chatter === null) {
            let id: string, name: string;
            if (typeof user === "string") {
                let resp;
                try {
                    resp = await this.api.getUsers({login: user});
                    id = resp.data[0].id;
                    name = user;
                } catch (e) {
                    TwitchAdapter.LOGGER.fatal("Unable to retrieve user from the API");
                    TwitchAdapter.LOGGER.error("Caused by: " + e.message);
                    TwitchAdapter.LOGGER.error(e.stack);
                    process.exit(1);
                }
            } else {
                id = user["user-id"];
                name = user.username;
            }

            chatter = await ChatterEntity.findById(id, channel); // Try to find by id

            if (chatter === null) { // Brand new chatter
                chatter = await ChatterEntity.from(id, name, channel);
                EventSystem.getInstance().dispatch(new NewChannelEvent(channel));
            } else { // Returning chatter, change name just in case
                chatter.name = name;
                await channel.save();
            }
        }

        return chatter;
    }

    async getChannelByName(channelName: string): Promise<ChannelEntity | null> {
        let channel = this.channelManager.findByName(channelName);

        if (channel === null) {
            let resp: helix.Response<helix.User>;
            try {
                resp = await this.api.getUsers({login: channelName});
            } catch (e) {
                logError(TwitchAdapter.LOGGER, e, "Unable to retrieve user from the API", true);
                process.exit(1);
            }
            const {id, login: name} = resp.data[0];

            channel = await ChannelEntity.findById(id, this.getName());

            if (channel === null) {
                channel = await ChannelEntity.from(id, name, this.getName());
                EventSystem.getInstance().dispatch(new NewChannelEvent(channel));
            } else {
                channel.name = name;
                await channel.save();
            }

            this.channelManager.add(channel);
        }

        return channel;
    }

    async unbanChatter(chatter: ChatterEntity): Promise<boolean> {
        try {
            await this.client.unban(chatter.getChannel().name, chatter.name);
            return true;
        } catch (e) {
            logError(TwitchAdapter.LOGGER, e, "Tried to unban chatter " + chatter.name + " but was unable to");
            return false;
        }
    }

    async banChatter(chatter: ChatterEntity, reason?: string): Promise<boolean> {
        try {
            await this.client.ban(chatter.getChannel().name, chatter.name, reason);
            return true;
        } catch (e) {
            logError(TwitchAdapter.LOGGER, e, "Tried to ban chatter " + chatter.name + " but was unable to");
            return false;
        }
    }

    async tempbanChatter(chatter: ChatterEntity, length: number, reason?: string): Promise<boolean> {
        try {
            await this.client.timeout(chatter.getChannel().name, chatter.name, length, reason);
            return true;
        } catch (e) {
            logError(TwitchAdapter.LOGGER, e, "Tried to time out chatter " + chatter.name + " but was unable to");
            return false;
        }
    }

    getName(): string {
        return "twitch";
    }
}