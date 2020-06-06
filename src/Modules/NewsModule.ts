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
import {CommandEventArgs} from "../Systems/Commands/CommandEvent";
import {string} from "../Systems/Commands/Validator/String";
import {integer} from "../Systems/Commands/Validator/Integer";
import StandardValidationStrategy from "../Systems/Commands/Validator/Strategies/StandardValidationStrategy";
import {ValidatorStatus} from "../Systems/Commands/Validator/Strategies/ValidationStrategy";
import {tuple} from "../Utilities/ArrayUtils";
import Adapter from "../Services/Adapter";
import {getLogger} from "../Utilities/Logger";
import {permission} from "../Systems/Permissions/decorators";
import {command, Subcommand} from "../Systems/Commands/decorators";
import {setting} from "../Systems/Settings/decorators";

export const MODULE_INFO = {
    name: "News",
    version: "1.0.0",
    description: "Automated messages that are sent periodically"
};

const logger = getLogger(MODULE_INFO.name);

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

    @Subcommand("add")
    async add({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "news add <message>",
            arguments: tuple(
                string({ name: "message", required: true, greedy: true })
            ),
            permission: this.newsModule.addItem
        }));
         if (status !== ValidatorStatus.OK) return;
        const [value] = args;

        try {
            const item = await NewsEntity.create(value, msg.getChannel());
            await response.message("news:added", {id: item.id});
        } catch (e) {
            await response.genericError();
            logger.error("Failed to add news item");
            logger.error("Caused by: " + e.message);
            logger.error(e.stack);
        }
    }

    @Subcommand("remove", "rem")
    async remove({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "news remove <index>",
            arguments: tuple(
                integer({ name: "item id", required: true })
            ),
            permission: this.newsModule.removeItem
        }));
         if (status !== ValidatorStatus.OK) return;
        const [id] = args;

        const item = await NewsEntity.get(id, {channel: msg.getChannel()});
        if (item === null) {
            await response.message("news:unknown", {id});
            return;
        }

        try {
            await item.delete();
            await response.message("news:removed", {id});
        } catch (e) {
            await response.genericError();
            logger.error("Failed to remove news item");
            logger.error("Caused by: " + e.message);
            logger.error(e.stack);
        }
    }

    @Subcommand("clear")
    async clear({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {status} = await event.validate(new StandardValidationStrategy({
            usage: "news clear",
            permission: this.newsModule.clearItems
        }));
         if (status !== ValidatorStatus.OK) return;

        const confirmation = await this.confirmationFactory(msg, "Are you sure you want to clear all news items?", 30);
        confirmation.addListener(ConfirmedEvent, async () => {
            try {
                await NewsEntity.removeEntries({channel: msg.getChannel()});
                await response.message("news:cleared");
            } catch (e) {
                await response.genericError();
                logger.error("Failed to clear news items");
            logger.error("Caused by: " + e.message);
            logger.error(e.stack);
            }
        });
        confirmation.run();
    }
}

@HandlesEvents()
export default class NewsModule extends AbstractModule {
    static [Symbols.ModuleInfo] = MODULE_INFO;
    private lastMessage: Map<string, LastMessage>;

    constructor(
        @inject(symbols.ConfirmationFactory) public makeConfirmation: ConfirmationFactory,
        @inject(ChannelManager) private channelManager: ChannelManager, @inject(Adapter) private adapter: Adapter
    ) {
        super(NewsModule);

        this.lastMessage = new Map();
    }

    @command newsCommand = new NewsCommand(this);

    @permission addItem = new Permission("news.add", Role.MODERATOR);
    @permission removeItem = new Permission("news.remove", Role.MODERATOR);
    @permission clearItems = new Permission("news.clear", Role.MODERATOR);
    @permission reload = new Permission("news.reload", Role.MODERATOR);

    @setting messageCount = new Setting("news.message-count", 5 as Integer, SettingType.INTEGER);
    @setting interval = new Setting("news.interval", 30 as Integer, SettingType.INTEGER);

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

        this.lastMessage.set(channel.channelId, {
            item: nextItem,
            timestamp: moment(),
            messageCount: 0
        });
        await this.adapter.sendMessage(nextItem.value, channel);
    }
}