import AbstractModule, {Symbols} from "./AbstractModule";
import {ConfirmationFactory, ConfirmedEvent} from "./ConfirmationModule";
import moment from "moment";
import MessageEvent from "../Chat/Events/MessageEvent";
import TickEvent from "../Application/TickEvent";
import NewsEntity from "../Database/Entities/NewsEntity";
import ChannelEntity from "../Database/Entities/ChannelEntity";
import {Role} from "../Systems/Permissions/Role";
import Permission from "../Systems/Permissions/Permission";
import Setting, {Integer, SettingType} from "../Systems/Settings/Setting";
import {EventArguments} from "../Systems/Event/Event";
import {EventHandler, HandlesEvents} from "../Systems/Event/decorators";
import {NewChannelEvent, NewChannelEventArgs} from "../Chat/Events/NewChannelEvent";
import {inject} from "inversify";
import symbols from "../symbols";
import ChannelManager from "../Chat/ChannelManager";
import Command from "../Systems/Commands/Command";
import {CommandEvent} from "../Systems/Commands/CommandEvent";
import Adapter from "../Adapters/Adapter";
import {getLogger} from "../Utilities/Logger";
import {permission} from "../Systems/Permissions/decorators";
import {command} from "../Systems/Commands/decorators";
import {setting} from "../Systems/Settings/decorators";
import {CommandHandler} from "../Systems/Commands/Validation/CommandHandler";
import CheckPermission from "../Systems/Commands/Validation/CheckPermission";
import {Argument, Channel, MessageArg, ResponseArg, RestArguments} from "../Systems/Commands/Validation/Argument";
import {Response} from "../Chat/Response";
import {EntityArg} from "../Systems/Commands/Validation/Entity";
import Message from "../Chat/Message";

export const MODULE_INFO = {
    name: "News",
    version: "1.1.1",
    description: "Automated messages that are sent periodically"
};

const logger = getLogger(MODULE_INFO.name);
const NewsItemArg = new EntityArg(NewsEntity, {msgKey: "news:unknown", optionKey: "id"});

interface LastMessage {
    item: NewsEntity;
    timestamp: moment.Moment;
    messageCount: number;
}

class NewsCommand extends Command {
    private readonly confirmationFactory: ConfirmationFactory;

    constructor(private readonly newsModule: NewsModule) {
        super("news", "<add|remove|clear>");

        this.confirmationFactory = newsModule.makeConfirmation;
    }

    @CommandHandler("news add", "news add <message>", 1)
    @CheckPermission("news.add")
    async add(
        event: CommandEvent, @ResponseArg response: Response, @Channel channel: ChannelEntity,
        @RestArguments(true, {join: " "}) value: string
    ): Promise<void> {
        return NewsEntity.create(value, channel)
            .then(item => response.message("news:added", {id: item.id}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^news rem(ove)?/, "news remove <id>", 1)
    @CheckPermission("news.remove")
    async remove(event: CommandEvent, @ResponseArg response: Response, @Argument(NewsItemArg) item: NewsEntity): Promise<void> {
        return item.delete()
            .then(() => response.message("news:removed", {id: item.id}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler("news edit", "news edit <id> <message>", 1)
    @CheckPermission("news.edit")
    async edit(
        event: CommandEvent, @ResponseArg response: Response,
        @Argument(NewsItemArg) item: NewsEntity, @RestArguments(true, {join: " "}) newMsg: string
    ): Promise<void> {
        item.value = newMsg;
        return item.save()
            .then(() => response.message("news:edited", {id: item.id}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler("news clear", "news clear", 1)
    @CheckPermission("news.clear")
    async clear(event: CommandEvent, @ResponseArg response: Response, @Channel channel: ChannelEntity, @MessageArg msg: Message): Promise<void> {
        const confirmMsg = await response.translate("news:clear-confirm");
        const confirm = await this.confirmationFactory(msg, confirmMsg, 30);
        confirm.addListener(ConfirmedEvent, async () => NewsEntity.removeEntries({channel})
            .then(() => response.message("news:cleared"))
            .catch(e => response.genericErrorAndLog(e, logger))
        );
        confirm.run();
    }
}

@HandlesEvents()
export default class NewsModule extends AbstractModule {
    static [Symbols.ModuleInfo] = MODULE_INFO;
    @command newsCommand = new NewsCommand(this);
    @permission addItem = new Permission("news.add", Role.MODERATOR);
    @permission removeItem = new Permission("news.remove", Role.MODERATOR);
    @permission clearItems = new Permission("news.clear", Role.MODERATOR);
    @permission reload = new Permission("news.reload", Role.MODERATOR);
    @setting messageCount = new Setting("news.message-count", 5 as Integer, SettingType.INTEGER);
    @setting interval = new Setting("news.interval", 30 as Integer, SettingType.INTEGER);
    private lastMessage: Map<string, LastMessage>;

    constructor(
        @inject(symbols.ConfirmationFactory) public makeConfirmation: ConfirmationFactory,
        @inject(ChannelManager) private channelManager: ChannelManager, @inject(Adapter) private adapter: Adapter
    ) {
        super(NewsModule);

        this.lastMessage = new Map();
    }

    @EventHandler(NewChannelEvent)
    async onNewChannel({channel}: NewChannelEventArgs): Promise<void> {
        await NewsEntity.createTable({channel});
    }

    async tryNext(channel: ChannelEntity, increment = false): Promise<void> {
        if (this.isDisabled(channel)) return;
        if (this.lastMessage.has(channel.channelId)) {
            const lastMessage = this.lastMessage.get(channel.channelId);
            const messageCount = await channel.getSetting(this.messageCount);
            const interval = moment.duration(await channel.getSetting(this.interval), "seconds");

            if (increment) lastMessage.messageCount++;
            const expires = lastMessage.timestamp.clone().add(interval);
            if (lastMessage.messageCount >= messageCount && moment().isAfter(expires))
                await this.showNextMessage(channel);
        } else {
            await this.showNextMessage(channel);
        }
    }

    @EventHandler(TickEvent)
    async tickHandler(): Promise<void> {
        await Promise.all(this.channelManager.getAll().map(channel => this.tryNext(channel)));
    }

    @EventHandler(MessageEvent)
    async messageHandler({event}: EventArguments<MessageEvent>): Promise<void> {
        this.tryNext(event.getMessage().getChannel(), true);
    }

    private async showNextMessage(channel: ChannelEntity): Promise<void> {
        const items: NewsEntity[] = await NewsEntity.getAll({channel});
        if (items.length < 1) return;
        let nextItem: NewsEntity = null;
        if (this.lastMessage.has(channel.channelId)) {
            const lastMessage = this.lastMessage.get(channel.channelId);
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

        this.lastMessage.set(channel.channelId, {item: nextItem, timestamp: moment(), messageCount: 0});
        await this.adapter.sendMessage(nextItem.value, channel);
    }
}