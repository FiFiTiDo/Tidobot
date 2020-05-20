import AbstractModule from "./AbstractModule";
import {ConfirmationFactory, ConfirmedEvent} from "./ConfirmationModule";
import moment from "moment";
import MessageEvent from "../Chat/Events/MessageEvent";
import TickEvent from "../Application/TickEvent";
import NewsEntity from "../Database/Entities/NewsEntity";
import ChannelEntity from "../Database/Entities/ChannelEntity";
import PermissionSystem from "../Systems/Permissions/PermissionSystem";
import {Role} from "../Systems/Permissions/Role";
import Permission from "../Systems/Permissions/Permission";
import Logger from "../Utilities/Logger";
import Setting, {SettingType} from "../Systems/Settings/Setting";
import SettingsSystem from "../Systems/Settings/SettingsSystem";
import {EventArguments} from "../Systems/Event/Event";
import {EventHandler, HandlesEvents} from "../Systems/Event/decorators";
import {NewChannelEvent, NewChannelEventArgs} from "../Chat/Events/NewChannelEvent";
import {inject} from "inversify";
import symbols from "../symbols";
import ChannelManager from "../Chat/ChannelManager";
import Bot from "../Application/Bot";
import Command from "../Systems/Commands/Command";
import {CommandEventArgs} from "../Systems/Commands/CommandEvent";
import CommandSystem from "../Systems/Commands/CommandSystem";
import {string} from "../Systems/Commands/Validator/String";
import {integer} from "../Systems/Commands/Validator/Integer";
import StandardValidationStrategy from "../Systems/Commands/Validator/Strategies/StandardValidationStrategy";
import {ValidatorStatus} from "../Systems/Commands/Validator/Strategies/ValidationStrategy";

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
            arguments: [
                string({ name: "message", required: true, greedy: true })
            ],
            permission: "news.add"
        }));
         if (status !== ValidatorStatus.OK) return;
        const [value] = args;

        try {
            const item = await NewsEntity.create(value, msg.getChannel());
            await response.message("news:added", {id: item.id});
        } catch (e) {
            await response.genericError();
            Logger.get().error("Failed to add news item", {cause: e});
        }
    }

    async remove({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "news remove <index>",
            arguments: [
                integer({ name: "item id", required: true })
            ],
            permission: "news.remove"
        }));
         if (status !== ValidatorStatus.OK) return;
        const [id] = args as [number];

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
            Logger.get().error("Failed to remove news item", {cause: e});
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
                Logger.get().error("Failed to clear news items", {cause: e});
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
        @inject(ChannelManager) private channelManager: ChannelManager, @inject(Bot) private bot: Bot
    ) {
        super(NewsModule.name);

        this.lastMessage = new Map();
    }

    initialize(): void {
        const cmd = CommandSystem.getInstance();
        cmd.registerCommand(new NewsCommand(this.makeConfirmation), this);

        const perm = PermissionSystem.getInstance();
        perm.registerPermission(new Permission("news.add", Role.MODERATOR));
        perm.registerPermission(new Permission("news.remove", Role.MODERATOR));
        perm.registerPermission(new Permission("news.clear", Role.MODERATOR));
        perm.registerPermission(new Permission("news.reload", Role.MODERATOR));

        const settings = SettingsSystem.getInstance();
        settings.registerSetting(new Setting("news.message-count", "5", SettingType.INTEGER));
        settings.registerSetting(new Setting("news.interval", "30", SettingType.INTEGER));
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
        await this.bot.send(nextItem.value, channel);
    }
}