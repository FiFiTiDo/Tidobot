import Adapter, {AdapterOptions} from "../Services/Adapter";
import MessageEvent from "../Chat/Events/MessageEvent";
import * as util from "util";
import {EventPriority} from "../Systems/Event/EventPriority";
import JoinEvent from "../Chat/Events/JoinEvent";
import LeaveEvent from "../Chat/Events/LeaveEvent";
import ConnectedEvent from "../Chat/Events/ConnectedEvent";
import DisconnectedEvent from "../Chat/Events/DisconnectedEvent";
import ChannelEntity from "../Database/Entities/ChannelEntity";
import ChatterEntity from "../Database/Entities/ChatterEntity";
import ChannelManager from "../Chat/ChannelManager";
import EventSystem from "../Systems/Event/EventSystem";
import {provide} from "inversify-binding-decorators";
import {NewChannelEvent, NewChannelEventArgs} from "../Chat/Events/NewChannelEvent";
import {NewChatterEvent, NewChatterEventArgs} from "../Chat/Events/NewChatterEvent";
import {getLogger} from "log4js";

@provide(Bot)
export default class Bot {
    public static readonly LOGGER = getLogger("Bot");

    constructor(private adapter: Adapter, private channelManager: ChannelManager) {
    }

    async start(options: AdapterOptions): Promise<void> {
        Bot.LOGGER.info("Starting the service " + this.adapter.getName() + "...");
        const dispatcher = EventSystem.getInstance();
        dispatcher.addListener(MessageEvent, async ({event}) => {
            const msg = event.getMessage();
            const logger = msg.getChannel().logger;
            logger.addContext("channel-id", msg.getChannel().channelId);
            logger.info(util.format("[%s] %s: %s", msg.getChannel().name, msg.getChatter().name, msg.getRaw()));
            if (await msg.getChatter().isIgnored()) event.stopPropagation();
            if (msg.getChatter().banned) event.stopPropagation();
        }, EventPriority.HIGHEST);
        dispatcher.addListener(JoinEvent, ({event}) => {
            const logger = event.getChannel().logger;
            logger.addContext("channel-id", event.getChannel().channelId);
            logger.info(util.format("%s has joined %s", event.getChatter().name, event.getChannel().name));
        });
        dispatcher.addListener(LeaveEvent, ({event}) => {
            const logger = event.getChannel().logger;
            logger.addContext("channel-id", event.getChannel().channelId);
            logger.info(util.format("%s has left %s", event.getChatter().name, event.getChannel().name));
        });
        dispatcher.addListener(ConnectedEvent, () => {
            Bot.LOGGER.info("Connected to the service.");
        }, EventPriority.MONITOR);
        dispatcher.addListener(DisconnectedEvent, ({event}) => {
            Bot.LOGGER.info("Disconnected from the service.", {reason: event.getMetadata("reason", "Unknown reason")});
        }, EventPriority.MONITOR);
        dispatcher.addListener(NewChannelEvent, async ({channel}: NewChannelEventArgs) => {
            Bot.LOGGER.info("Connected to a new channel: ", channel.name);
        });
        dispatcher.addListener(NewChatterEvent, async ({chatter}: NewChatterEventArgs) => {
            const logger = chatter.getChannel().logger;
            logger.addContext("channel-id", chatter.getChannel().channelId);
            logger.info(`New chatter joined the channel: ${chatter.name}`);
        });
        this.adapter.run(options);
    }

    async send(message: string, channel: ChannelEntity): Promise<void> {
        return this.adapter.sendMessage(message, channel);
    }

    async action(action: string, channel: ChannelEntity): Promise<void> {
        return this.adapter.sendAction(action, channel);
    }

    async unbanChatter(chatter: ChatterEntity): Promise<void> {
        return this.adapter.unbanChatter(chatter);
    }

    async banChatter(chatter: ChatterEntity, reason?: string): Promise<void> {
        return this.adapter.banChatter(chatter, reason);
    }

    async tempbanChatter(chatter: ChatterEntity, length: number, reason?: string): Promise<void> {
        return this.adapter.tempbanChatter(chatter, length, reason);
    }

    async broadcast(message: string): Promise<void[]> {
        const ops: Promise<void>[] = [];
        for (const channel of this.channelManager.getAll())
            ops.push(this.adapter.sendMessage(message, channel));
        return Promise.all(ops);
    }

    async spam(message: string, channel: ChannelEntity, times: number, seconds = 1): Promise<void> {
        const send = async (): Promise<void> => {
            await this.adapter.sendMessage(message, channel);
            if (--times > 0) setTimeout(send, seconds * 1000);
        };
        return send();
    }
}