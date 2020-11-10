import Adapter, {AdapterOptions} from "../Adapters/Adapter";
import MessageEvent from "../Chat/Events/MessageEvent";
import * as util from "util";
import {EventPriority} from "../Systems/Event/EventPriority";
import JoinEvent from "../Chat/Events/JoinEvent";
import LeaveEvent from "../Chat/Events/LeaveEvent";
import ConnectedEvent from "../Chat/Events/ConnectedEvent";
import DisconnectedEvent from "../Chat/Events/DisconnectedEvent";
import EventSystem from "../Systems/Event/EventSystem";
import {NewChannelEvent} from "../Chat/Events/NewChannelEvent";
import {NewChatterEvent} from "../Chat/Events/NewChatterEvent";
import {getLogger} from "../Utilities/Logger";
import { Service } from "typedi";

@Service()
export default class Bot {
    public static readonly LOGGER = getLogger("Bot");

    constructor(private adapter: Adapter, private readonly eventSystem: EventSystem) {
    }

    async start(options: AdapterOptions): Promise<void> {
        Bot.LOGGER.info("Starting the service " + this.adapter.getName() + "...");
        this.eventSystem.addListener(MessageEvent, event => {
            const message = event.extra.get(MessageEvent.EXTRA_MESSAGE);
            const sender = message.chatter;
            const senderUser = sender.user;
            const channel = message.channel;

            channel.logger.info(util.format("[%s] %s: %s", channel.name, senderUser.name, message.raw));
            if (senderUser.ignored) event.cancel();
            if (sender.banned) event.cancel();
        }, EventPriority.HIGHEST);
        this.eventSystem.addListener(JoinEvent, event => {
            const channel = event.extra.get(JoinEvent.EXTRA_CHANNEL);
            const chatter = event.extra.get(JoinEvent.EXTRA_CHATTER);
            channel.logger.info(util.format("%s has joined %s", chatter.user.name, channel.name));
        });
        this.eventSystem.addListener(LeaveEvent, event => {
            const channel = event.extra.get(LeaveEvent.EXTRA_CHANNEL);
            const chatter = event.extra.get(LeaveEvent.EXTRA_CHATTER);
            channel.logger.info(util.format("%s has left %s", chatter.user.name, channel.name));
        });
        this.eventSystem.addListener(ConnectedEvent, () => {
            Bot.LOGGER.info("Connected to the service.");
        }, EventPriority.MONITOR);
        this.eventSystem.addListener(DisconnectedEvent, event => {
            const reason = event.extra.get(DisconnectedEvent.EXTRA_REASON) || "Unknown reason";
            Bot.LOGGER.info("Disconnected from the service.", {reason});
        }, EventPriority.MONITOR);
        this.eventSystem.addListener(NewChannelEvent, event => {
            const channel = event.extra.get(NewChannelEvent.EXTRA_CHANNEL);
            Bot.LOGGER.info("Connected to a new channel: ", channel.name);
        });
        this.eventSystem.addListener(NewChatterEvent, event => {
            const chatter = event.extra.get(NewChatterEvent.EXTRA_CHATTER);
            chatter.channel.logger.info(`New chatter joined the channel: ${chatter.user.name}`);
        });
        this.adapter.run(options);
    }

    async shutdown(): Promise<void> {
        await this.adapter.stop();
    }
}