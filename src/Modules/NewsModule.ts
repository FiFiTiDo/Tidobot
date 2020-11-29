import AbstractModule, {Symbols} from "./AbstractModule";
import ConfirmationModule, {ConfirmedEvent} from "./ConfirmationModule";
import moment from "moment";
import MessageEvent from "../Chat/Events/MessageEvent";
import TickEvent from "../Application/Events/TickEvent";
import {Role} from "../Systems/Permissions/Role";
import Permission from "../Systems/Permissions/Permission";
import Setting, {Integer, SettingType} from "../Systems/Settings/Setting";
import {EventHandler, HandlesEvents} from "../Systems/Event/decorators";
import Command from "../Systems/Commands/Command";
import Adapter from "../Adapters/Adapter";
import {getLogger} from "../Utilities/Logger";
import {CommandHandler} from "../Systems/Commands/Validation/CommandHandler";
import CheckPermission from "../Systems/Commands/Validation/CheckPermission";
import {Argument, ChannelArg, MessageArg, ResponseArg, RestArguments} from "../Systems/Commands/Validation/Argument";
import {Response} from "../Chat/Response";
import {EntityArg} from "../Systems/Commands/Validation/Entity";
import Message from "../Chat/Message";
import { Channel } from "../Database/Entities/Channel";
import { Inject, Service } from "typedi";
import { NewsRepository } from "../Database/Repositories/NewsRepository";
import { InjectRepository } from "typeorm-typedi-extensions";
import { News } from "../Database/Entities/News";
import { AdapterToken } from "../symbols";
import Event from "../Systems/Event/Event";
import ChannelManager from "../Chat/ChannelManager";
import EventSystem from "../Systems/Event/EventSystem";

export const MODULE_INFO = {
    name: "News",
    version: "1.2.0",
    description: "Automated messages that are sent periodically"
};

const logger = getLogger(MODULE_INFO.name);
const NewsItemArg = new EntityArg(NewsRepository, {msgKey: "news:unknown", optionKey: "id"});

interface LastMessage {
    item: News;
    timestamp: moment.Moment;
    messageCount: number;
}

@Service()
class NewsCommand extends Command {
    constructor(
        @InjectRepository() private readonly newsRepository: NewsRepository,
        private readonly confirmationModule: ConfirmationModule
    ) {
        super("news", "<add|remove|clear>");
    }

    @CommandHandler("news add", "news add <message>", 1)
    @CheckPermission(() => NewsModule.permissions.addItem)
    async add(
        event: Event, @ResponseArg response: Response, @ChannelArg channel: Channel,
        @RestArguments(true, {join: " "}) content: string
    ): Promise<void> {
        return this.newsRepository.make(content, channel)
            .then(item => response.message("news:added", {id: item.id}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^news rem(ove)?/, "news remove <id>", 1)
    @CheckPermission(() => NewsModule.permissions.removeItem)
    async remove(event: Event, @ResponseArg response: Response, @Argument(NewsItemArg) item: News): Promise<void> {
        return item.remove()
            .then(() => response.message("news:removed", {id: item.id}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler("news edit", "news edit <id> <message>", 1)
    @CheckPermission(() => NewsModule.permissions.editItem)
    async edit(
        event: Event, @ResponseArg response: Response,
        @Argument(NewsItemArg) item: News, @RestArguments(true, {join: " "}) content: string
    ): Promise<void> {
        item.content = content;
        return item.save()
            .then(() => response.message("news:edited", {id: item.id}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler("news clear", "news clear", 1)
    @CheckPermission(() => NewsModule.permissions.clearItems)
    async clear(event: Event, @ResponseArg response: Response, @ChannelArg channel: Channel, @MessageArg msg: Message): Promise<void> {
        const confirmMsg = await response.translate("news:clear-confirm");
        const confirm = await this.confirmationModule.make(msg, confirmMsg, 30);
        confirm.addListener(ConfirmedEvent, async () => this.newsRepository.remove(channel.newsItems)
            .then(() => response.message("news:cleared"))
            .catch(e => response.genericErrorAndLog(e, logger))
        );
        confirm.run();
    }
}

@Service()
export default class NewsModule extends AbstractModule {
    static [Symbols.ModuleInfo] = MODULE_INFO;
    static permissions = {
        addItem: new Permission("news.add", Role.MODERATOR),
        editItem: new Permission("news.edit", Role.MODERATOR),
        removeItem: new Permission("news.remove", Role.MODERATOR),
        clearItems: new Permission("news.clear", Role.MODERATOR),
        reload: new Permission("news.reload", Role.MODERATOR),
    }
    static settings = {
        messageCount: new Setting("news.message-count", 5 as Integer, SettingType.INTEGER),
        interval: new Setting("news.interval", 30 as Integer, SettingType.INTEGER)
    }

    private lastMessage: Map<number, LastMessage>;

    constructor(
        @InjectRepository() private readonly newsRepository: NewsRepository, newsCommand: NewsCommand,
        private readonly channelManager: ChannelManager, @Inject(AdapterToken) private readonly adapter: Adapter,
        eventSystem: EventSystem
    ) {
        super(NewsModule);

        this.lastMessage = new Map();
        this.registerCommand(newsCommand);
        this.registerPermissions(NewsModule.permissions);
        this.registerSettings(NewsModule.settings);
        eventSystem.addListener(MessageEvent, this.messageHandler.bind(this));
        eventSystem.addListener(TickEvent, this.tickHandler.bind(this));
    }

    async tryNext(channel: Channel, increment = false): Promise<void> {
        if (this.isDisabled(channel)) return;
        if (this.lastMessage.has(channel.id)) {
            const lastMessage = this.lastMessage.get(channel.id);
            const messageCount = channel.settings.get(NewsModule.settings.messageCount);
            const interval = moment.duration(channel.settings.get(NewsModule.settings.interval), "seconds");

            if (increment) lastMessage.messageCount++;
            const expires = lastMessage.timestamp.clone().add(interval);
            if (lastMessage.messageCount >= messageCount && moment().isAfter(expires))
                await this.showNextMessage(channel);
        } else {
            await this.showNextMessage(channel);
        }
    }

    @EventHandler(TickEvent)
    async tickHandler(): Promise<void> {/* TODO: Fix
        await Promise.all((await this.channelManager.getAllActive()).map(channel => this.tryNext(channel)));*/
    }

    @EventHandler(MessageEvent)
    async messageHandler(event: Event): Promise<void> {
        this.tryNext(event.extra.get(MessageEvent.EXTRA_MESSAGE).channel, true);
    }

    private async showNextMessage(channel: Channel): Promise<void> {
        const [items, count] = await this.newsRepository.findAndCount({ channel });
        if (count < 1) return;
        let nextItem: News = null;
        if (this.lastMessage.has(channel.id)) {
            const lastMessage = this.lastMessage.get(channel.id);
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (item.id === lastMessage.item.id) {
                    const j = (i + 1) % items.length;
                    nextItem = items[j];
                    break;
                }

                if (item.id > lastMessage.item.id) {
                    nextItem = item;
                    break;
                }
            }
        }
        if (nextItem === null) nextItem = items[0];

        this.lastMessage.set(channel.id, {item: nextItem, timestamp: moment(), messageCount: 0});
        await this.adapter.sendMessage(nextItem.content, channel);
    }
}