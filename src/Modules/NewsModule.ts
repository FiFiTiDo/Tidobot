import AbstractModule from "./AbstractModule";
import CommandModule, {CommandEvent, SubcommandHelper} from "./CommandModule";
import PermissionModule, {PermissionLevel} from "./PermissionModule";
import ChannelSchemaBuilder from "../Database/ChannelSchemaBuilder";
import Channel from "../Chat/Channel";
import Application from "../Application/Application";
import {__} from "../Utilities/functions";
import ConfirmationModule, {ConfirmedEvent} from "./ConfirmationModule";
import moment from "moment";
import MessageEvent from "../Chat/Events/MessageEvent";
import Dispatcher from "../Event/Dispatcher";
import SettingsModule from "./SettingsModule";
import TickEvent from "../Application/TickEvent";
import NewsEntity from "../Database/Entities/NewsEntity";
import Entity from "../Database/Entities/Entity";

interface LastMessage {
    item: NewsEntity;
    timestamp: moment.Moment;
    message_count: number;
}

export default class NewsModule extends AbstractModule {
    private last_message: Map<string, LastMessage>;

    constructor() {
        super(NewsModule.name);

        this.last_message = new Map();
    }

    initialize() {
        const cmd = this.getModuleManager().getModule(CommandModule);
        cmd.registerCommand("news", this.newsCommand, this);

        const perm = this.getModuleManager().getModule(PermissionModule);
        perm.registerPermission("news.add", PermissionLevel.MODERATOR);
        perm.registerPermission("news.remove", PermissionLevel.MODERATOR);
        perm.registerPermission("news.clear", PermissionLevel.MODERATOR);
        perm.registerPermission("news.reload", PermissionLevel.MODERATOR);

        const settings = this.getModuleManager().getModule(SettingsModule);
        settings.registerSetting("news.message-count", "5", "integer");
        settings.registerSetting("news.interval", "30", "integer");
    }

    registerListeners(dispatcher: Dispatcher) {
        dispatcher.addListener(MessageEvent, this.messageHandler);
        dispatcher.addListener(TickEvent, this.tickHandler);
    }

    unregisterListeners(dispatcher: Dispatcher) {
        dispatcher.removeListener(MessageEvent, this.messageHandler);
        dispatcher.removeListener(TickEvent, this.tickHandler);
    }

    createDatabaseTables(builder: ChannelSchemaBuilder) {
        builder.addTable("news", table => {
            table.string("value");
        });
    }

    tryNext = async (channel: Channel, increment = false) => {
        if (this.isDisabled(channel)) return;
        if (this.last_message.has(channel.getId())) {
            let last_msg = this.last_message.get(channel.getId());
            let message_count = await channel.getSettings().get("news.message-count");
            let interval = moment.duration(await channel.getSettings().get("news.interval"), "seconds");

            if (increment) last_msg.message_count++;
            let expires = last_msg.timestamp.clone().add(interval);
            if (last_msg.message_count >= message_count && moment().isAfter(expires))
                await this.showNextMessage(channel);
        } else {
            await this.showNextMessage(channel);
        }
    };

    tickHandler = async () => Promise.all(Application.getChannelManager().getAll().map(channel => this.tryNext(channel)));
    messageHandler = async (event: MessageEvent) => this.tryNext(event.getMessage().getChannel(), true);

    async newsCommand(event: CommandEvent) {
        let args = await event.validate({
            usage: "news <add|remove|clear> [arguments]",
            arguments: [
                {
                    type: "string",
                    required: true
                }
            ]
        });
        if (args === null) return;

        new SubcommandHelper.Builder()
            .addSubcommand("add", this.add)
            .addSubcommand("remove", this.remove)
            .addSubcommand("rem", this.remove)
            .addSubcommand("clear", this.clear)
            .build(this)
            .handle(event);
    }

    async add(event: CommandEvent) {
        let msg = event.getMessage();
        let args = await event.validate({
            usage: "news add <message>",
            arguments: [
                {
                    type: "string",
                    required: true,
                    greedy: true
                }
            ],
            permission: "news.add"
        });
        if (args === null) return;
        let [value] = args;

        try {
            let item = await NewsEntity.create(value, msg.getChannel());
            await msg.reply(__("news.add.successful", item.id));
        } catch (e) {
            await msg.reply(__("news.add.failed"));
            Application.getLogger().error("Failed to add news item", {cause: e});
        }
    };

    async remove(event: CommandEvent) {
        let msg = event.getMessage();
        let args = await event.validate({
            usage: "news remove <index>",
            arguments: [
                {
                    type: "integer",
                    required: true
                }
            ],
            permission: "news.remove"
        });
        if (args === null) return;
        let [id] = args as [number];

        let item = await NewsEntity.get(id, this.getServiceName(), msg.getChannel().getName());
        if (item === null) {
            await msg.reply(__("news.invalid_id", id));
            return;
        }

        try {
            await item.delete();
            await msg.reply(__("news.remove.successful", id));
        } catch (e) {
            await msg.reply(__("news.remove.failed"));
            Application.getLogger().error("Failed to remove news item", {cause: e});
        }
    };

    async clear(event: CommandEvent) {
        let msg = event.getMessage();
        let args = await event.validate({
            usage: "news clear",
            permission: "news.clear"
        });
        if (args === null) return;

        let confirmation = await ConfirmationModule.make(msg, "Are you sure you want to clear all news items?", 30);
        confirmation.addListener(ConfirmedEvent, async () => {
            try {
                await msg.getChannel().query("news").delete().exec();
                await msg.reply(__("news.clear.successful"));
            } catch (e) {
                await msg.reply(__("news.clear.failed"));
                Application.getLogger().error("Failed to clear news items", {cause: e});
            }
        });
        confirmation.run();
    };

    private async showNextMessage(channel: Channel): Promise<void> {
        let items: NewsEntity[] = await NewsEntity.getAll(this.getServiceName(), channel.getName());
        if (items.length < 1) return;
        let next_item: NewsEntity = null;
        if (this.last_message.has(channel.getId())) {
            let last_msg = this.last_message.get(channel.getId());
            for (let i = 0; i < items.length; i++) {
                let item = items[i];
                if (item.id === last_msg.item.id) {
                    let j = (i + 1) % items.length;
                    next_item = items[j];
                    break;
                }

                if (item.id > last_msg.item.id) {
                    next_item = item;
                    break;
                }
            }
        }
        if (next_item === null) next_item = items[0];

        this.last_message.set(channel.getId(), {
            item: next_item,
            timestamp: moment(),
            message_count: 0
        });
        await Application.getAdapter().sendMessage(next_item.value, channel);
    }
}