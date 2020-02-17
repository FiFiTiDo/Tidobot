import AbstractModule from "./AbstractModule";
import Dispatcher from "../Event/Dispatcher";
import MessageEvent from "../Chat/Events/MessageEvent";
import CommandModule, {CommandEvent, SubcommandHelper} from "./CommandModule";
import PermissionModule, {PermissionLevel} from "./PermissionModule";
import SettingsModule from "./SettingsModule";
import ChannelSchemaBuilder from "../Database/ChannelSchemaBuilder";
import Channel from "../Chat/Channel";
import Application from "../Application/Application";
import {__} from "../Utilities/functions";
import ConfirmationModule, {ConfirmedEvent} from "./ConfirmationModule";
import moment from "moment";
import Chatter, {ChatterStateList} from "../Chat/Chatter";
import {TwitchMessage} from "../Services/Twitch/TwitchMessage";
import Message from "../Chat/Message";
import {StringToBooleanConverter, StringToIntegerConverter} from "../Utilities/Converter";

const DOT = /\s?\(dot\)\s?/gi;
const URL_PATTERN = /((http|ftp|https|sftp):\/\/)?(([\w.-]*)\.([\w]*))/igm;
const CAPS_PATTERN = /[A-Z]/g;
const SYMBOLS_PATTERN = /[`~!@#$%^&*()-_=+\[{\]}\\|;:'",<.>/?]/g;
const FAKE_PURGE = /^<message \w+>|^<\w+ deleted>/i;

export default class FilterModule extends AbstractModule {
    private permits: ChatterStateList<moment.Moment>;
    private strikes: ChatterStateList<number>;

    constructor() {
        super(FilterModule.name);

        this.permits = new ChatterStateList(null);
        this.strikes = new ChatterStateList(0);
    }

    initialize() {
        const cmd = this.getModuleManager().getModule(CommandModule);
        cmd.registerCommand("permit", this.permitCmd, this);
        cmd.registerCommand("pardon", this.pardonCmd, this);
        cmd.registerCommand("purge", this.purgeCmd, this);
        cmd.registerCommand("filter", this.filterCmd, this);

        const perm = this.getModuleManager().getModule(PermissionModule);
        perm.registerPermission("filter.ignore", PermissionLevel.MODERATOR);
        perm.registerPermission("filter.permit", PermissionLevel.MODERATOR);
        perm.registerPermission("filter.list.add", PermissionLevel.MODERATOR);
        perm.registerPermission("filter.list.remove", PermissionLevel.MODERATOR);
        perm.registerPermission("filter.list.reset", PermissionLevel.MODERATOR);
        perm.registerPermission("filter.pardon", PermissionLevel.MODERATOR);
        perm.registerPermission("filter.purge", PermissionLevel.MODERATOR);

        const settings = this.getModuleManager().getModule(SettingsModule);
        settings.registerSetting("filter.urls.whitelist", "true", StringToBooleanConverter.func);
        settings.registerSetting("filter.caps.enabled", "true", StringToBooleanConverter.func);
        settings.registerSetting("filter.caps.amount", "20", StringToIntegerConverter.func);
        settings.registerSetting("filter.spam.enabled", "true", StringToBooleanConverter.func);
        settings.registerSetting("filter.spam.amount", "15", StringToIntegerConverter.func);
        settings.registerSetting("filter.symbols.enabled", "true", StringToBooleanConverter.func);
        settings.registerSetting("filter.symbols.amount", "20", StringToIntegerConverter.func);
        settings.registerSetting("filter.emotes.enabled", "true", StringToBooleanConverter.func);
        settings.registerSetting("filter.emotes.whitelist", "true", StringToBooleanConverter.func);
        settings.registerSetting("filter.emotes.amount", "20", StringToIntegerConverter.func);
        settings.registerSetting("filter.fake-purge.enabled", "true", StringToBooleanConverter.func);
        settings.registerSetting("filter.bad-word.enabled", "true", StringToBooleanConverter.func);
        settings.registerSetting("filter.long-message.enabled", "true", StringToBooleanConverter.func);
        settings.registerSetting("filter.long-message.length", "325", StringToIntegerConverter.func);
        settings.registerSetting("filter.ignore-subs", "true", StringToBooleanConverter.func);
        settings.registerSetting("filter.ignore-vips", "true", StringToBooleanConverter.func);
        settings.registerSetting("filter.ignore-premium", "true", StringToBooleanConverter.func);
        settings.registerSetting("filter.permit-length", "30", StringToIntegerConverter.func);
        settings.registerSetting("filter.purge-length", "1", StringToIntegerConverter.func);
        settings.registerSetting("filter.strike.1", "0", StringToIntegerConverter.func);
        settings.registerSetting("filter.strike.2", "600", StringToIntegerConverter.func);
        settings.registerSetting("filter.strike.3", "28800", StringToIntegerConverter.func);
    }

    createDatabaseTables(builder: ChannelSchemaBuilder) {
        builder.addTable("filters", table => {
            table.string("channel_id").unique().references("channel", "id");
            table.string("domains");
            table.string("bad_words");
            table.string("emotes");
        });
    }

    registerListeners(dispatcher: Dispatcher) {
        dispatcher.addListener(MessageEvent, this.messageHandler);
    }

    unregisterListeners(dispatcher: Dispatcher) {
        dispatcher.removeListener(MessageEvent, this.messageHandler);
    }

    messageHandler = async (event: MessageEvent) => {
        let msg = event.getMessage();
        let channel = msg.getChannel();

        if (await msg.checkPermission("filter.ignore")) return;
        if (this.permits.hasChatter(msg.getChatter())) {
            let timestamp = this.permits.getChatter(msg.getChatter());
            let expires = timestamp.clone().add(await msg.getChannel().getSettings().get("filter.permit-length"), "seconds");
            if (moment().isBefore(expires)) {
                return;
            } else {
                this.permits.removeChatter(msg.getChatter());
            }
        }
        let user_levels = await msg.getUserLevels();
        if (user_levels.indexOf(PermissionLevel.REGULAR) >= 0) return;
        if (user_levels.indexOf(PermissionLevel.SUBSCRIBER) >= 0 &&
            await msg.getChannel().getSettings().get("filter.ignore-subs")) return;
        if (user_levels.indexOf(PermissionLevel.VIP) >= 0 &&
            await msg.getChannel().getSettings().get("filter.ignore-vips")) return;
        if (user_levels.indexOf(PermissionLevel.PREMIUM) >= 0 &&
            await msg.getChannel().getSettings().get("filter.ignore-premium")) return;

        let lists = await FilterLists.retrieveOrMake(channel);

        let no_dot = msg.getRaw().replace(DOT, ".");
        let whitelist_url = await msg.getChannel().getSettings().get("filter.urls.whitelist");
        while (true) {
            let res = URL_PATTERN.exec(no_dot);
            if (res === null) break;
            let domain = res[3];

            if (whitelist_url ? !lists.has(domain, "domain") : lists.has(domain, "domain")) {
                await this.nextStrike(__("filter.reasons.url"), msg);
                return;
            }
        }

        if (await msg.getChannel().getSettings().get("filter.caps.enabled")) {
            let amount = (msg.getRaw().match(CAPS_PATTERN) || []).length;
            if (amount >= await msg.getChannel().getSettings().get("filter.caps.amount")) {
                await this.nextStrike(__("filter.reasons.caps"), msg);
                return;
            }
        }

        if (await msg.getChannel().getSettings().get("filter.spam.enabled")) {
            // TODO: Add spam filter
        }

        if (await msg.getChannel().getSettings().get("filter.symbols.enabled")) {
            let amount = (msg.getRaw().match(SYMBOLS_PATTERN) || []).length;
            if (amount >= await msg.getChannel().getSettings().get("filter.symbols.amount")) {
                await this.nextStrike(__("filter.reasons.symbols"), msg);
                return;
            }
        }

        if (await msg.getChannel().getSettings().get("filter.emotes.enabled")) {
            let bad_words = lists.getList("emote");
            let lower = msg.getRaw().toLowerCase();
            let whitelist = await msg.getChannel().getSettings().get("filter.emotes.whitelist");
            for (let bad_word of bad_words) {
                if  (whitelist ? lower.indexOf(bad_word.toLowerCase()) < 0 : lower.indexOf(bad_word.toLowerCase()) >= 0) {
                    await this.nextStrike(__("filter.reasons.emote.blacklisted"), msg);
                    return;
                }
            }

            if (msg instanceof TwitchMessage) {
                let amount = Object.values(msg.getUserState().emotes).reduce<number>((previous, next) => {
                    return previous + next.length;
                }, 0);
                if (amount >= await msg.getChannel().getSettings().get("filter.emotes.amount")) {
                    await this.nextStrike(__("filter.reasons.emote.too_many"), msg);
                    return;
                }
            }
        }

        if (await msg.getChannel().getSettings().get("filter.fake-purge.enabled")) {
            if (FAKE_PURGE.test(msg.getRaw())) {
                await this.nextStrike(__("filter.reasons.fake_purge"), msg);
                return;
            }
        }

        if (await msg.getChannel().getSettings().get("filter.bad-word.enabled")) {
            let bad_words = lists.getList("bad-word");
            let lower = msg.getRaw().toLowerCase();
            for (let bad_word of bad_words) {
                if  (lower.indexOf(bad_word.toLowerCase()) >= 0) {
                    await this.nextStrike(__("filter.reasons.bad_word"), msg);
                    return;
                }
            }
        }

        if (await msg.getChannel().getSettings().get("filter.long-message.enabled")) {
            if (msg.getRaw().length >= await msg.getChannel().getSettings().get("filter.long-message.length")) {
                await this.nextStrike(__("filter.reasons.long_message"), msg);
                return;
            }
        }
    };

    async nextStrike(reason: string, msg: Message) {
        let strike = (this.strikes.getChatter(msg.getChatter()) + 1) % 4;
        this.strikes.setChatter(msg.getChatter(), strike);

        await msg.reply(__("filter.strike", msg.getChatter().getName(), reason, strike));
    }

    async permitCmd(event: CommandEvent) {
        let msg = event.getMessage();
        let args = await event.validate({
            usage: "permit <user>",
            arguments: [
                {
                    type: "chatter",
                    required: true
                }
            ],
            permission: "filter.permit"
        });
        if (args === null) return;
        let chatter = args[1] as Chatter;

        this.permits.setChatter(chatter, moment());
        await msg.reply(__("filter.permit", chatter.getName(), await msg.getChannel().getSettings().get("filter.permit-length")));
    }

    async pardonCmd(event: CommandEvent) {
        let msg = event.getMessage();
        let args = await event.validate({
            usage: "pardon <user>",
            arguments: [
                {
                    type: "chatter",
                    required: true
                }
            ],
            permission: "filter.clear-strikes"
        });
        if (args === null) return;
        let chatter = args[1] as Chatter;

        this.strikes.setChatter(chatter, 0);
        await msg.reply(__("filter.strikes-cleared", chatter.getName()));
    }

    async purgeCmd(event: CommandEvent) {
        let msg = event.getMessage();
        let args = await event.validate({
            usage: "purge <user>",
            arguments: [
                {
                    type: "chatter",
                    required: true
                }
            ],
            permission: "filter.purge"
        });
        if (args === null) return;
        let chatter = args[1] as Chatter;
        await chatter.tempban(await msg.getChannel().getSettings().get("filter.purge-length"), "Purged by " + msg.getChatter().getName());
        await msg.reply(__("filter.purged", chatter.getName()));
    }

    async filterCmd(event: CommandEvent) {
        new SubcommandHelper.Builder()
            .addSubcommand("add", this.addSubCmd)
            .addSubcommand("remove", this.removeSubCmd)
            .addSubcommand("rem", this.removeSubCmd)
            .addSubcommand("reset", this.resetSubCmd)
            .build(this)
            .handle(event);
    }

    async addSubCmd(event: CommandEvent) {
        let msg = event.getMessage();
        let args = await event.validate({
            usage: "filter add <list> <item>",
            arguments: [
                {
                    type: "string",
                    required: true,
                    accepted: ["add"]
                },
                {
                    type: "string",
                    required: true,
                    accepted: ["domain", "bad-word", "emote"]
                },
                {
                    type: "string",
                    required: true,
                    greedy: true
                }
            ],
            permission: "filter.list.add"
        });
        if (args === null) return;
        let [, list, item] = args;
        let lists = await FilterLists.retrieveOrMake(msg.getChannel());
        let resp = await lists.add(item, list);

        switch (resp) {
            case FilterListResponse.DB_ERROR:
                await msg.reply(__("filter.list.add.successful", item, list));
                break;
            case FilterListResponse.EXISTING_ITEM:
                await msg.reply(__("filter.list.add.already_exists", list, item));
                break;
            case FilterListResponse.SUCCESSFUL:
                await msg.reply(__("filter.list.remove.failed"));
                break;
        }
    }

    async removeSubCmd(event: CommandEvent) {
        let msg = event.getMessage();
        let args = await event.validate({
            usage: "filter remove <list> <item>",
            arguments: [
                {
                    type: "string",
                    required: true,
                    accepted: ["add"]
                },
                {
                    type: "string",
                    required: true,
                    accepted: ["domain", "bad-word", "emote"]
                },
                {
                    type: "string",
                    required: true,
                    greedy: true
                }
            ],
            permission: "filter.list.remove"
        });
        if (args === null) return;
        let [, list, item] = args;
        let lists = await FilterLists.retrieveOrMake(msg.getChannel());
        let resp = await lists.remove(item, list);

        switch (resp) {
            case FilterListResponse.DB_ERROR:
                await msg.reply(__("filter.list.remove.successful", item, list));
                break;
            case FilterListResponse.NON_EXISTENT_ITEM:
                await msg.reply(__("filter.list.remove.non_existent", list, item));
                break;
            case FilterListResponse.SUCCESSFUL:
                await msg.reply(__("filter.list.remove.failed"));
                break;
        }
    }

    async resetSubCmd(event: CommandEvent) {
        let msg = event.getMessage();
        let args = await event.validate({
            usage: "filter reset [list]",
            arguments: [
                {
                    type: "string",
                    required: true,
                    accepted: ["add"]
                },
                {
                    type: "string",
                    required: false,
                    accepted: ["domain", "bad-word", "emote"]
                }
            ],
            permission: "filter.list.add"
        });
        if (args === null) return;
        let [, list] = args;
        let lists = await FilterLists.retrieveOrMake(msg.getChannel());

        let confirmation = await ConfirmationModule.make(msg, `filter.list.reset.${list ? "specific" : "all"}.confirmation`, 30);
        confirmation.addListener(ConfirmedEvent, async () => {
            if (list) {
                switch (await lists.reset(list)) {
                    case FilterListResponse.DB_ERROR:
                        await msg.reply(__(`filter.list.reset.specific.successful`, list));
                        break;
                    case FilterListResponse.SUCCESSFUL:
                        await msg.reply(__(`filter.list.reset.specific.failed`, list));
                        break;
                }
            } else {
                switch (await lists.resetAll()) {
                    case FilterListResponse.DB_ERROR:
                        await msg.reply(__(`filter.list.reset.all.successful`, list));
                        break;
                    case FilterListResponse.SUCCESSFUL:
                        await msg.reply(__(`filter.list.reset.all.failed`, list));
                        break;
                }
            }
        });
        confirmation.run();
    }
}

enum FilterListResponse {
    INVALID_LIST, EXISTING_ITEM, NON_EXISTENT_ITEM, DB_ERROR, SUCCESSFUL
}


type ListTypes = "domain"|"bad-word"|"emote";
class FilterLists {
    private readonly channel: Channel;
    private readonly domains: string[];
    private readonly bad_words: string[];
    private readonly emotes: string[];

    constructor(domains: string[], bad_words: string[], emotes: string[], channel: Channel) {
        this.domains = domains;
        this.bad_words = bad_words;
        this.emotes = emotes;
        this.channel = channel;
    }

    public getList(list: string|ListTypes): string[]|null {
        if (list === "domain") return this.domains;
        if (list === "bad-word") return this.bad_words;
        if (list === "emote") return this.emotes;
        return null;
    }

    async add(item: string, list: string): Promise<FilterListResponse> {
        let array = this.getList(list);
        if (array === null) return FilterListResponse.INVALID_LIST;
        if (array.indexOf(item) >= 0) return FilterListResponse.EXISTING_ITEM;
        array.push(item);
        try {
            await this.save();
        } catch(e) {
            return FilterListResponse.DB_ERROR;
        }
        return FilterListResponse.SUCCESSFUL;
    }

    async remove(item: string, list: string): Promise<FilterListResponse> {
        let array = this.getList(list);
        if (array === null) return FilterListResponse.INVALID_LIST;
        let i = array.indexOf(item);
        if (i < 0) return FilterListResponse.NON_EXISTENT_ITEM;
        array.splice(i, 1);
        try {
            await this.save();
        } catch(e) {
            return FilterListResponse.DB_ERROR;
        }
        return FilterListResponse.SUCCESSFUL;
    }

    async reset(list: string): Promise<FilterListResponse> {
        let array = this.getList(list);
        if (array === null) return FilterListResponse.INVALID_LIST;
        array.splice(0, array.length);
        try {
            await this.save();
        } catch(e) {
            return FilterListResponse.DB_ERROR;
        }
        return FilterListResponse.SUCCESSFUL;
    }

    has(item: string, list: ListTypes): FilterListResponse {
        let array = this.getList(list);
        if (array === null) return FilterListResponse.INVALID_LIST;
        for (let element of array)
            if (element.toLowerCase() === item.toLowerCase()) return FilterListResponse.EXISTING_ITEM;
        return FilterListResponse.NON_EXISTENT_ITEM;
    }

    async resetAll(): Promise<FilterListResponse> {
        this.domains.splice(0, this.domains.length);
        this.bad_words.splice(0, this.bad_words.length);
        this.emotes.splice(0, this.emotes.length);
        try {
            await this.save();
            return FilterListResponse.SUCCESSFUL;
        } catch (e) {
            return FilterListResponse.DB_ERROR;
        }
    }

    async save() {
        return Application.getDatabase().table("filters").insert({
            channel_id: this.channel.getId(),
            domains: this.domains.join(","),
            bad_words: this.bad_words.join(","),
            emotes: this.emotes.join(",")
        }).or("REPLACE").exec();
    }

    static async retrieveOrMake(channel: Channel) {
        let rows = await Application.getDatabase().table("filters")
            .select().where().eq("channel_id", channel.getId()).done().all();
        if (rows.length < 1) {
            let lists = new FilterLists([], [], [], channel);
            await lists.save();
            return lists;
        }
        return new FilterLists(
            rows[0].domains.split(","),
            rows[0].bad_words.split(","),
            rows[0].emotes.split(","),
            channel
        );
    }
}