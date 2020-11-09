import Adapter, {AdapterOptions} from "../Adapters/Adapter";
import MessageEvent from "../Chat/Events/MessageEvent";
import * as util from "util";
import {EventPriority} from "../Systems/Event/EventPriority";
import JoinEvent from "../Chat/Events/JoinEvent";
import LeaveEvent from "../Chat/Events/LeaveEvent";
import ConnectedEvent from "../Chat/Events/ConnectedEvent";
import DisconnectedEvent from "../Chat/Events/DisconnectedEvent";
import EventSystem from "../Systems/Event/EventSystem";
import {NewChannelEvent, NewChannelEventArgs} from "../Chat/Events/NewChannelEvent";
import {NewChatterEvent, NewChatterEventArgs} from "../Chat/Events/NewChatterEvent";
import {getLogger} from "../Utilities/Logger";
import { Service } from "typedi";

@Service()
export default class Bot {
    public static readonly LOGGER = getLogger("Bot");

    constructor(private adapter: Adapter, private readonly eventSystem: EventSystem) {
    }

    async start(options: AdapterOptions): Promise<void> {
        Bot.LOGGER.info("Starting the service " + this.adapter.getName() + "...");
        this.eventSystem.addListener(MessageEvent, async ({event}) => {
            const message = event.getMessage();
            const sender = message.chatter;
            const senderUser = sender.user;
            const channel = message.channel;

            channel.logger.info(util.format("[%s] %s: %s", channel.name, senderUser.name, message.raw));
            if (senderUser.ignored) event.cancel();
            if (sender.banned) event.cancel();
        }, EventPriority.HIGHEST);
        this.eventSystem.addListener(JoinEvent, ({event}) => {
            event.channel.logger.info(util.format("%s has joined %s", event.chatter.user.name, event.channel.name));
        });
        this.eventSystem.addListener(LeaveEvent, ({event}) => {
            event.channel.logger.info(util.format("%s has left %s", event.chatter.user.name, event.channel.name));
        });
        this.eventSystem.addListener(ConnectedEvent, () => {
            Bot.LOGGER.info("Connected to the service.");
        }, EventPriority.MONITOR);
        this.eventSystem.addListener(DisconnectedEvent, ({event}) => {
            Bot.LOGGER.info("Disconnected from the service.", {reason: event.getMetadata("reason", "Unknown reason")});
        }, EventPriority.MONITOR);
        this.eventSystem.addListener(NewChannelEvent, async ({channel}: NewChannelEventArgs) => {
            Bot.LOGGER.info("Connected to a new channel: ", channel.name);
        });
        this.eventSystem.addListener(NewChatterEvent, async ({chatter}: NewChatterEventArgs) => {
            chatter.channel.logger.info(`New chatter joined the channel: ${chatter.user.name}`);
        });
        this.adapter.run(options);
    }

    async shutdown(): Promise<void> {
        await this.adapter.stop();
    }
}