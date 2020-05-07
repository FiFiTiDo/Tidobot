import AbstractModule from "./AbstractModule";
import CommandModule, {Command, CommandEventArgs} from "./CommandModule";
import ChannelSchemaBuilder from "../Database/ChannelSchemaBuilder";
import {ConfirmationFactory, ConfirmedEvent} from "./ConfirmationModule";
import moment from "moment";
import MessageEvent from "../Chat/Events/MessageEvent";
import TickEvent from "../Application/TickEvent";
import NewsEntity from "../Database/Entities/NewsEntity";
import ChannelEntity from "../Database/Entities/ChannelEntity";
import PermissionSystem from "../Systems/Permissions/PermissionSystem";
import {Role} from "../Systems/Permissions/Role";
import Permission from "../Systems/Permissions/Permission";
import {Key} from "../Utilities/Translator";
import Logger from "../Utilities/Logger";
import Setting, {SettingType} from "../Systems/Settings/Setting";
import SettingsSystem from "../Systems/Settings/SettingsSystem";
import {EventArguments} from "../Systems/Event/Event";
import {EventHandler} from "../Systems/Event/decorators";

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
        const args = await event.validate({
            usage: "news add <message>",
            arguments: [
                {
                    value: {
                        type: "string",
                    },
                    required: true,
                    greedy: true
                }
            ],
            permission: "news.add"
        });
        if (args === null) return;
        const [value] = args;

        try {
            const item = await NewsEntity.create(value, msg.getChannel());
            await response.message(Key("news.add.successful"), item.id);
        } catch (e) {
            await response.message(Key("news.add.failed"));
            Logger.get().error("Failed to add news item", {cause: e});
        }
    }

    async remove({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "news remove <index>",
            arguments: [
                {
                    value: {
                        type: "integer",
                    },
                    required: true
                }
            ],
            permission: "news.remove"
        });
        if (args === null) return;
        const [id] = args as [number];

        const item = await NewsEntity.get(id, { channel: msg.getChannel() });
        if (item === null) {
            await response.message(Key("news.invalid_id"), id);
            return;
        }

        try {
            await item.delete();
            await response.message(Key("news.remove.successful"), id);
        } catch (e) {
            await response.message(Key("news.remove.failed"));
            Logger.get().error("Failed to remove news item", {cause: e});
        }
    }

    async clear({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "news clear",
            permission: "news.clear"
        });
        if (args === null) return;

        const confirmation = await this.confirmationFactory(msg, "Are you sure you want to clear all news items?", 30);
        confirmation.addListener(ConfirmedEvent, async () => {
            try {
                await NewsEntity.removeEntries({ channel: msg.getChannel() });
                await response.message(Key("news.clear.successful"));
            } catch (e) {
                await response.message(Key("news.clear.failed"));
                Logger.get().error("Failed to clear news items", {cause: e});
            }
        });
        confirmation.run();
    }
}

export default class NewsModule extends AbstractModule {
    private lastMessage: Map<string, LastMessage>;

    constructor() {
        super(NewsModule.name);

        this.lastMessage = new Map();
    }

    initialize(): void {
        const cmd = this.getModuleManager().getModule(CommandModule);
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

    createDatabaseTables(builder: ChannelSchemaBuilder): void {
        builder.addTable("news", table => {
            table.string("value");
        });
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
    tickHandler = async (): Promise<void[]> => Promise.all(this.channelManager.getAll().map(channel => this.tryNext(channel)));

    @EventHandler(MessageEvent)
    messageHandler = async ({event}: EventArguments<MessageEvent>): Promise<void> => this.tryNext(event.getMessage().getChannel(), true);

    private async showNextMessage(channel: ChannelEntity): Promise<void> {
        const items: NewsEntity[] = await NewsEntity.getAll({ channel });
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