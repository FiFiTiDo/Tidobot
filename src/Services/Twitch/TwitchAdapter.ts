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
import Config from "../../Utilities/Config";
import {inject, injectable} from "inversify";
import symbols from "../../symbols";
import Logger from "../../Utilities/Logger";
import EventSystem from "../../Systems/Event/EventSystem";
import Bot from "../../Application/Bot";

@injectable()
export default class TwitchAdapter extends Adapter {
    public client: tmi.Client;
    public api: helix.Api;
    public oldApi: kraken.Api;

    constructor(
        @inject(Bot) private bot: Bot, @inject(symbols.Config) private config: Config,
        @inject(symbols.TwitchMessageFactory) private messageFactory: TwitchMessageFactory
    ) {
        super();

        this.api = new helix.Api(config.get("twitch.api.clientId"), config.get("twitch.api.clientSecret"));
        this.oldApi = new kraken.Api(config.get("twitch.api.clientId"));
    }

    async run(options: AdapterOptions): Promise<void> {
        this.client = tmi.Client({
            identity: this.config.get("twitch.identities." + options.identity, this.config.get("twitch.identities.default")),
            channels: options.channels[0] == Application.DEFAULT_CHANNEL ? this.config.get("twitch.defaultChannels") : options.channels
        });

        this.client.on("message", async (channelName: string, userstate: tmi.ChatUserstate, message: string, self: boolean) => {
            if (self) return;

            const channel = await this.getChannelByName(channelName.substring(1));
            const chatter = await this.getChatter(userstate, channel);

            EventSystem.getInstance().dispatch(new MessageEvent(this.messageFactory(message, chatter, channel, userstate)));
        });

        this.client.on("join", async (channelName: string, username: string, self: boolean) => {
            if (self) return;

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
            if (typeof user === "string") {
                let resp;
                try {
                    resp = await this.api.getUsers({login: user});
                } catch (e) {
                    Logger.get().emerg("Unable to retrieve user from the API", {cause: e});
                    process.exit(1);
                }
                chatter = await ChatterEntity.from(resp.data[0].id, user, channel);
            } else {
                chatter = await ChatterEntity.from(user.id, user.username, channel);
            }
            await chatter.save();
        }

        return chatter;
    }

    async getChannelByName(channelName: string): Promise<ChannelEntity|null> {
        let channel = this.bot.getChannelManager().findByName(channelName);

        if (channel === null) {
            let resp: helix.Response<helix.User>;
            try {
                resp = await this.api.getUsers({ login: channelName });
            } catch (e) {
                Logger.get().emerg("Unable to retrieve user from the API", {cause: e});
                process.exit(1);
            }
            const { id, login: name } = resp.data[0];

            channel = await ChannelEntity.from(id, name, "twitch");
            channel.name = name;
            await channel.save();
        }

        return channel;
    }

    async unbanChatter(chatter: ChatterEntity): Promise<[string, string]> {
        return this.client.unban(chatter.getChannel().name, chatter.name);
    }

    async banChatter(chatter: ChatterEntity, reason?: string): Promise<[string, string, string]> {
        return this.client.ban(chatter.getChannel().name, chatter.name, reason);
    }

    async tempbanChatter(chatter: ChatterEntity, length: number, reason?: string): Promise<[string, string, number, string]> {
        return this.client.timeout(chatter.getChannel().name, chatter.name, length, reason);
    }

    getName(): string {
        return "twitch";
    }
}