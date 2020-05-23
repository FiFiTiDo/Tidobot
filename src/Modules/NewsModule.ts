import AbstractModule, {ModuleInfo, Systems} from "./AbstractModule";
import {ConfirmationFactory, ConfirmedEvent} from "./ConfirmationModule";
import moment from "moment";
import MessageEvent from "../Chat/Events/MessageEvent";
import TickEvent from "../Application/TickEvent";
import NewsEntity from "../Database/Entities/NewsEntity";
import ChannelEntity from "../Database/Entities/ChannelEntity";
import {Role} from "../Systems/Permissions/Role";
import Permission from "../Systems/Permissions/Permission";
import Setting, {SettingType} from "../Systems/Settings/Setting";
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
import {getLogger} from "log4js";

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
    constructor(private confirmationFactory: ConfirmationFactory) {
        super("news", "<add|remove|clear>");

        this.addSubcommand("add", this.add);
        this.addSubcommand("remove", this.remove);
        this.addSubcommand("rem", this.remove);
        this.addSubcommand("clear", this.clear);
    }

    async add({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "news add <message>",
            arguments: tuple(
                string({ name: "message", required: true, greedy: true })
            ),
            permission: "news.add"
        }));
         if (status !== ValidatorStatus.OK) return;
        const [value] = args;

        try {
            const item = await NewsEntity.create(value, msg.getChannel());
            await response.message("news:added", {id: item.id});
        } catch (e) {
            await response.genericError();
            logger.error("Failed to add news item");
            logger.trace("Caused by: " + e.message);
        }
    }

    async remove({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "news remove <index>",
            arguments: tuple(
                integer({ name: "item id", required: true })
            ),
            permission: "news.remove"
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
            logger.trace("Caused by: " + e.message);
        }
    }

    async clear({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {status} = await event.validate(new StandardValidationStrategy({
            usage: "news clear",
            permission: "news.clear"
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
            logger.trace("Caused by: " + e.message);
            }
        });
        confirmation.run();
    }
}

@HandlesEvents()
export default class NewsModule extends AbstractModule {
    private lastMessage: Map<string, LastMessage>;

    constructor(
        @inject(symbols.ConfirmationFactory) private makeConfirmation: ConfirmationFactory,
        @inject(ChannelManager) private channelManager: ChannelManager, @inject(Adapter) private adapter: Adapter
    ) {
        super(NewsModule.name);

        this.lastMessage = new Map();
    }

    initialize({ command, permission, settings }: Systems): ModuleInfo {
        command.registerCommand(new NewsCommand(this.makeConfirmation), this);
        permission.registerPermission(new Permission("news.add", Role.MODERATOR));
        permission.registerPermission(new Permission("news.remove", Role.MODERATOR));
        permission.registerPermission(new Permission("news.clear", Role.MODERATOR));
        permission.registerPermission(new Permission("news.reload", Role.MODERATOR));
        settings.registerSetting(new Setting("news.message-count", "5", SettingType.INTEGER));
        settings.registerSetting(new Setting("news.interval", "30", SettingType.INTEGER));

        return MODULE_INFO;
    }

    @EventHandler(NewChannelEvent)
    async onNewChannel({channel}: NewChannelEventArgs): Promise<void> {
        await NewsEntity.createTable({channel});
    }

    tryNext = async (channel: ChannelEntity, increment = false): Promise<void> => {
        if (this.isDisabled(channel)) return;
        if (this.lastMessage.has(channel.channelId)) {
            const lastMessage = this.lastMessage.get(channel.channelId);
            const messageCount = await channel.getSetting<number>("news.message-count");
            const interval = moment.duration(await channel.getSetting<number>("news.interval"), "seconds");

            if (increment) lastMessage.messageCount++;
            const expires = lastMessage.timestamp.clone().add(interval);
            if (lastMessage.messageCount >= messageCount && moment().isAfter(expires))
                await this.showNextMessage(channel);
        } else {
            await this.showNextMessage(channel);
        }
    };

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