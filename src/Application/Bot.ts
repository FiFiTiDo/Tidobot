import {injectable} from "inversify";
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
import Logger from "../Utilities/Logger";
import EventSystem from "../Systems/Event/EventSystem";
import {provide} from "inversify-binding-decorators";

@provide(Bot)
export default class Bot {
    constructor(private adapter: Adapter, private channelManager: ChannelManager) {
    }

    start(options: AdapterOptions): void {
        Logger.get().info("Starting the service " + this.adapter.getName() + "...");
        const dispatcher = EventSystem.getInstance();
        dispatcher.addListener(MessageEvent, ({event}) => {
            const msg = event.getMessage();
            Logger.get().info(util.format("[%s] %s: %s", msg.getChannel().name, msg.getChatter().name, msg.getRaw()));
            if (msg.getChatter().banned) event.stopPropagation(); // TODO: Add ignored
        }, EventPriority.HIGHEST);
        dispatcher.addListener(JoinEvent, ({event}) => {
            Logger.get().info(util.format("%s has joined %s", event.getChatter().name, event.getChannel().name));
        });
        dispatcher.addListener(LeaveEvent, ({event}) => {
            Logger.get().info(util.format("%s has left %s", event.getChatter().name, event.getChannel().name));
        });
        dispatcher.addListener(ConnectedEvent, () => {
            Logger.get().info("Connected to the service.");
        }, EventPriority.MONITOR);
        dispatcher.addListener(DisconnectedEvent, ({event}) => {
            Logger.get().info("Disconnected from the service.", {reason: event.getMetadata("reason", "Unknown reason")});
        }, EventPriority.MONITOR);
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