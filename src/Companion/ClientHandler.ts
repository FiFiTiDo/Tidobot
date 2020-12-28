import { isUndefined, noop } from "lodash";
import { Logger } from "log4js";
import WebSocket from "ws";
import Adapter from "../Adapters/Adapter";
import Event from "../Systems/Event/Event";
import EventSystem from "../Systems/Event/EventSystem";
import { getLogger, logError } from "../Utilities/Logger";
import Optional from "../Utilities/Patterns/Optional";
import { CompanionConnectedEvent } from "./Events/CompanionConnectedEvent";
import { CloseCode, CompanionDisconnectedEvent } from "./Events/CompanionDisconnectedEvent";
import { CompanionErrorEvent } from "./Events/CompanionErrorEvent";
import { FollowEvent } from "./Events/FollowEvent";
import { StartStreamEvent } from "./Events/StartStreamEvent";
import { StopStreamEvent } from "./Events/StopStreamEvent";
import { SubscriptionEvent } from "./Events/SubscriptionEvent";
import { TipEvent } from "./Events/TipEvent";
import { WebSocketMessage } from "./WebSocketMessage";
import {Channel} from "../Database/Entities/Channel";
import {ChannelRepository} from "../Database/Repositories/ChannelRepository";
import * as jwt from "jsonwebtoken"

export class ClientHandler {
    public isAlive = true;
    private readonly logger: Logger;
    private channel: Channel = null;

    constructor(
        public readonly socket: WebSocket, 
        private readonly channelRepository: ChannelRepository,
        private readonly adapter: Adapter,
        private readonly eventSystem: EventSystem
    ) {
        this.logger = getLogger("CompanionClient");
        socket.on("message", this.handleMessage.bind(this));
        socket.on("error", this.handleError.bind(this));
        socket.on("close", this.handleClose.bind(this));
        socket.on("ping", () => this.socket.pong(noop));
        socket.on("pong", () => this.isAlive = true);
    }

    public get authenticated(): boolean {
        return this.channel !== null;
    }

    async sendMessage(message: WebSocketMessage): Promise<void> {
        return new Promise((resolve, reject) => this.socket.send(message, e => isUndefined(e) ? resolve(): reject(e)));
    }

    async sendError(code: string, message: string): Promise<void> {
        return this.sendMessage({ type: "error", extra: { code, message } });
    }

    private async handleError(err: Error): Promise<void> {
        logError(this.logger, err);
        const event = new Event(CompanionErrorEvent);
        event.extra.put(CompanionErrorEvent.EXTRA_CLIENT, this);
        event.extra.put(CompanionErrorEvent.EXTRA_IDENTITY, this.channel);
        event.extra.put(CompanionErrorEvent.EXTRA_ERROR, err);
        await this.eventSystem.dispatch(event);
    }

    private async handleClose(code: number, reason: string): Promise<void> {
        if (this.channel === null) return;

        this.logger.info("Companion disconnected [%d] %s", code, reason);
        const event = new Event(CompanionDisconnectedEvent);
        event.extra.put(CompanionDisconnectedEvent.EXTRA_IDENTITY, this.channel);
        event.extra.put(CompanionDisconnectedEvent.EXTRA_CODE, CloseCode[CloseCode[code]]);
        event.extra.put(CompanionDisconnectedEvent.EXTRA_REASON, reason);
        await this.eventSystem.dispatch(event);

        this.channel = null;
    }

    private async handleMessage(data: WebSocket.Data): Promise<void> {
        this.logger.debug(data);
        const message = JSON.parse(data.toString()) as WebSocketMessage;

        if (message.type === "authenticate")
            return this.handleAuthenticate(message);
        else if (!this.authenticated)
            return this.sendError("access-denied", "You are unable to do that, please authenticate before proceeding.");

        switch (message.type) {
            case    "alert:tip": return this.handleTip(message);
            case "alert:follow": return this.handleFollow(message);
            case    "alert:sub": return this.handleSubscription(message);
            case "stream:start": return this.handleStartStream();
            case  "stream:stop": return this.handleStopStream();
        }
    }

    private async handleAuthenticate(message: WebSocketMessage): Promise<void> {
        const { token } = message.extra;
        let id: number;
        try {
            id = jwt.verify(token, "").id
        } catch(e) {
            this.sendError("invalid-token", "The provided token could not be verified.");
            return;
        }

        const channel = await this.channelRepository.findOne({ id });
        if (isUndefined(channel)) {
            this.sendError("unknown-channel", "Could not find an channel with the given id.");
            return;
        }
        this.channel = channel;
        const { nativeId, name } = this.channel;
        this.sendMessage({ type: "authenticated", extra: { id, nativeId, name } });

        const event = new Event(CompanionConnectedEvent);
        event.extra.put(CompanionConnectedEvent.EXTRA_CHANNEL, channel);
        await this.eventSystem.dispatch(event);
    }

    private async handleTip(message: WebSocketMessage): Promise<void> {
        const { name, amount, message: donoMessage } = message.extra;
        const event = new Event(TipEvent);
        event.extra.put(TipEvent.EXTRA_NAME, name);
        event.extra.put(TipEvent.EXTRA_AMOUNT, amount);
        event.extra.put(TipEvent.EXTRA_MESSAGE, donoMessage);
        event.extra.put(TipEvent.EXTRA_CHANNEL, this.channel);
        await this.eventSystem.dispatch(event);
    }

    private async handleFollow(message: WebSocketMessage): Promise<void> {
        const { id, name } = message.extra;

        const user = await this.adapter.userAdapter.getOrCreateUser(name, id);
        const chatter = await this.adapter.chatterRepository.retreiveOrMake(user, this.channel);

        const event = new Event(FollowEvent);
        event.extra.put(FollowEvent.EXTRA_CHATTER, chatter);
        event.extra.put(FollowEvent.EXTRA_CHANNEL, this.channel);
        await this.eventSystem.dispatch(event);
    }

    private async handleSubscription(message: WebSocketMessage): Promise<void> {
        const { id, name, type, months, message: subMessage } = message.extra;

        const user = isUndefined(id) ?
            await this.adapter.userAdapter.getUserByName(name) :
            await this.adapter.userAdapter.getOrCreateUser(name, id);
        const chatter = await this.adapter.chatterRepository.retreiveOrMake(user, this.channel);

        const event = new Event(SubscriptionEvent);
        event.extra.put(SubscriptionEvent.EXTRA_CHATTER, chatter);
        event.extra.put(SubscriptionEvent.EXTRA_TYPE, Optional.ofUndefable(type));
        event.extra.put(SubscriptionEvent.EXTRA_MONTHS, months);
        event.extra.put(SubscriptionEvent.EXTRA_MESSAGE, Optional.ofUndefable(subMessage));
        event.extra.put(SubscriptionEvent.EXTRA_CHANNEL, this.channel);
        await this.eventSystem.dispatch(event);
    }

    private async handleStartStream(): Promise<void> {
        const event = new Event(StartStreamEvent);
        event.extra.put(StartStreamEvent.EXTRA_CHANNEL, this.channel);
        await this.eventSystem.dispatch(event);
    }

    private async handleStopStream(): Promise<void> {
        const event = new Event(StopStreamEvent);
        event.extra.put(StopStreamEvent.EXTRA_CHANNEL, this.channel);
        await this.eventSystem.dispatch(event);
    }
}