import AbstractModule from "./AbstractModule";
import MessageEvent from "../Chat/Events/MessageEvent";
import {ConfirmationFactory, ConfirmedEvent} from "./ConfirmationModule";
import moment from "moment";
import {TwitchMessage} from "../Services/Twitch/TwitchMessage";
import Message from "../Chat/Message";
import ChatterEntity, {ChatterStateList} from "../Database/Entities/ChatterEntity";
import FiltersEntity from "../Database/Entities/FiltersEntity";
import {array_add, array_contains, array_remove} from "../Utilities/ArrayUtils";
import {Key, TranslationKey} from "../Utilities/Translator";
import Bot from "../Application/Bot";
import {getMaxRole, Role} from "../Systems/Permissions/Role";
import PermissionSystem from "../Systems/Permissions/PermissionSystem";
import Permission from "../Systems/Permissions/Permission";
import Setting, {SettingType} from "../Systems/Settings/Setting";
import SettingsSystem from "../Systems/Settings/SettingsSystem";
import {EventArguments} from "../Systems/Event/Event";
import {NewChannelEvent, NewChannelEventArgs} from "../Chat/Events/NewChannelEvent";
import {EventHandler, HandlesEvents} from "../Systems/Event/decorators";
import {inject} from "inversify";
import symbols from "../symbols";
import Command from "../Systems/Commands/Command";
import {CommandEventArgs} from "../Systems/Commands/CommandEvent";
import CommandSystem from "../Systems/Commands/CommandSystem";

const DOT = /\s?\(dot\)\s?/gi;
const URL_PATTERN = /((http|ftp|https|sftp):\/\/)?(([\w.-]*)\.([\w]*))/igm;
const CAPS_PATTERN = /[A-Z]/g;
const SYMBOLS_PATTERN = /[`~!@#$%^&*()-_=+[{\]}\\|;:'",<.>/?]/g;
const FAKE_PURGE = /^<message \w+>|^<\w+ deleted>/i;



class PermitCommand extends Command {
    constructor(private filterModule: FilterModule) {
        super("permit", "<user>");
    }

    async execute({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "permit <user>",
            arguments: [
                {
                    value: {
                        type: "chatter",
                    },
                    required: true
                }
            ],
            permission: "filter.permit"
        });
        if (args === null) return;
        const [chatter] = args as [ChatterEntity];

        this.filterModule.permits.setChatter(chatter, moment());
        await response.message(Key("filter.permit"), chatter.name, await msg.getChannel().getSettings().get("filter.permit-length"));
    }
}

class PardonCommand extends Command {
    constructor(private filterModule: FilterModule) {
        super("pardon", "<user>");
    }

    async execute({event, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "pardon <user>",
            arguments: [
                {
                    value: {
                        type: "chatter",
                    },
                    required: true
                }
            ],
            permission: "filter.clear-strikes"
        });
        if (args === null) return;
        const [chatter] = args as [ChatterEntity];

        this.filterModule.strikes.setChatter(chatter, 0);
        await response.message(Key("filter.strikes-cleared"), chatter.name);
    }
}

class PurgeCommand extends Command {
    constructor(private bot: Bot) {
        super("purge", "<user>");
    }

    async execute({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "purge <user>",
            arguments: [
                {
                    value: {
                        type: "chatter",
                    },
                    required: true
                }
            ],
            permission: "filter.purge"
        });
        if (args === null) return;
        const [chatter] = args as [ChatterEntity];
        await this.bot.tempbanChatter(chatter, await msg.getChannel().getSettings().get("filter.purge-length"), "Purged by " + msg.getChatter().name);
        await response.message(Key("filter.purged"), chatter.name);
    }
}

class FilterCommand extends Command {
    constructor(private makeConfirmation: ConfirmationFactory) {
        super("filter", "<add|remove|reset>");
    }

    async add({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "filter add <list> <item>",
            arguments: [
                {
                    value: {
                        type: "string",
                        accepted: ["domains", "bad_words", "emotes"]
                    },
                    required: true
                },
                {
                    value: {
                        type: "string",
                    },
                    required: true,
                    greedy: true
                }
            ],
            permission: "filter.list.add"
        });
        if (args === null) return;
        const [list, item] = args as ["domains"|"bad_words"|"emotes", string];
        const lists = await FiltersEntity.getByChannel(msg.getChannel());

        if (array_add(item, lists[list])) {
            try {
                await lists.save();
                await response.message(Key("filter.list.add.successful"), item, list);
            } catch (e) {
                await response.message(Key("filter.list.add.failed"));
            }
        } else
            await response.message(Key("filter.list.add.already_exists"), list, item);
    }

    async remove({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "filter remove <list> <item>",
            arguments: [
                {
                    value: {
                        type: "string",
                        accepted: ["domain", "bad-word", "emote"]
                    },
                    required: true
                },
                {
                    value: {
                        type: "string",
                    },
                    required: true,
                    greedy: true
                }
            ],
            permission: "filter.list.remove"
        });
        if (args === null) return;
        const [list, item] = args as ["domains"|"bad_words"|"emotes", string];
        const lists = await FiltersEntity.getByChannel(msg.getChannel());

        if (array_remove(item, lists[list])) {
            try {
                await lists.save();
                await response.message(Key("filter.list.remove.successful"), item, list);
            } catch (e) {
                await response.message(Key("filter.list.remove.failed"));
            }
        } else
            await response.message(Key("filter.list.remove.non_existent"), list, item);
    }

    async reset({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "filter reset [list]",
            arguments: [
                {
                    value: {
                        type: "string",
                        accepted: ["domain", "bad-word", "emote"]
                    },
                    required: false
                }
            ],
            permission: "filter.list.add"
        });
        if (args === null) return;
        const [list] = args as ["domains"|"bad_words"|"emotes"];
        const lists = await FiltersEntity.getByChannel(msg.getChannel());

        const confirmation = await this.makeConfirmation(msg, response.getTranslator().translate(`filter.list.reset.${list ? "specific" : "all"}.confirmation`), 30);
        confirmation.addListener(ConfirmedEvent, async () => {
            if (list) {
                lists[list] = [];

                await lists.save()
                    .then(() => response.message(Key("filter.list.reset.specific.successful"), list))
                    .catch(() => response.message(Key("filter.list.reset.specific.failed"), list));
            } else {
                lists.badWords = [];
                lists.emotes = [];
                lists.domains = [];

                await lists.save()
                    .then(() => response.message(Key("filter.list.reset.all.successful")))
                    .catch(() => response.message(Key("filter.list.reset.all.failed")));
            }
        });
        confirmation.run();
    }
}

@HandlesEvents()
export default class FilterModule extends AbstractModule {
    permits: ChatterStateList<moment.Moment>;
    strikes: ChatterStateList<number>;

    constructor(@inject(Bot) private bot: Bot, @inject(symbols.ConfirmationFactory) private makeConfirmation: ConfirmationFactory) {
        super(FilterModule.name);

        this.permits = new ChatterStateList(null);
        this.strikes = new ChatterStateList(0);
    }

    initialize(): void {
        const cmd = CommandSystem.getInstance();
        cmd.registerCommand(new PermitCommand(this), this);
        cmd.registerCommand(new PardonCommand(this), this);
        cmd.registerCommand(new PurgeCommand(this.bot), this);
        cmd.registerCommand(new FilterCommand(this.makeConfirmation), this);

        const perm = PermissionSystem.getInstance();
        perm.registerPermission(new Permission("filter.ignore", Role.MODERATOR));
        perm.registerPermission(new Permission("filter.permit", Role.MODERATOR));
        perm.registerPermission(new Permission("filter.list.add", Role.MODERATOR));
        perm.registerPermission(new Permission("filter.list.remove", Role.MODERATOR));
        perm.registerPermission(new Permission("filter.list.reset", Role.MODERATOR));
        perm.registerPermission(new Permission("filter.pardon", Role.MODERATOR));
        perm.registerPermission(new Permission("filter.purge", Role.MODERATOR));

        const settings = SettingsSystem.getInstance();
        settings.registerSetting(new Setting("filter.urls.whitelist", "true", SettingType.BOOLEAN));
        settings.registerSetting(new Setting("filter.caps.enabled", "true", SettingType.BOOLEAN));
        settings.registerSetting(new Setting("filter.caps.amount", "20", SettingType.INTEGER));
        settings.registerSetting(new Setting("filter.spam.enabled", "true", SettingType.BOOLEAN));
        settings.registerSetting(new Setting("filter.spam.amount", "15", SettingType.INTEGER));
        settings.registerSetting(new Setting("filter.symbols.enabled", "true", SettingType.BOOLEAN));
        settings.registerSetting(new Setting("filter.symbols.amount", "20", SettingType.INTEGER));
        settings.registerSetting(new Setting("filter.emotes.enabled", "true", SettingType.BOOLEAN));
        settings.registerSetting(new Setting("filter.emotes.whitelist", "true", SettingType.BOOLEAN));
        settings.registerSetting(new Setting("filter.emotes.amount", "20", SettingType.INTEGER));
        settings.registerSetting(new Setting("filter.fake-purge.enabled", "true", SettingType.BOOLEAN));
        settings.registerSetting(new Setting("filter.bad-word.enabled", "true", SettingType.BOOLEAN));
        settings.registerSetting(new Setting("filter.long-message.enabled", "true", SettingType.BOOLEAN));
        settings.registerSetting(new Setting("filter.long-message.length", "325", SettingType.INTEGER));
        settings.registerSetting(new Setting("filter.ignore-subs", "true", SettingType.BOOLEAN));
        settings.registerSetting(new Setting("filter.ignore-vips", "true", SettingType.BOOLEAN));
        settings.registerSetting(new Setting("filter.ignore-premium", "true", SettingType.BOOLEAN));
        settings.registerSetting(new Setting("filter.permit-length", "30", SettingType.INTEGER));
        settings.registerSetting(new Setting("filter.purge-length", "1", SettingType.INTEGER));
        settings.registerSetting(new Setting("filter.strike.1", "0", SettingType.INTEGER));
        settings.registerSetting(new Setting("filter.strike.2", "600", SettingType.INTEGER));
        settings.registerSetting(new Setting("filter.strike.3", "28800", SettingType.INTEGER));
    }

    @EventHandler(NewChannelEvent)
    async onNewChannel({ channel }: NewChannelEventArgs): Promise<void> {
        await FiltersEntity.createForChannel(channel);
    }

    @EventHandler(MessageEvent)
    async handleMessage({event}: EventArguments<MessageEvent>): Promise<void> {
        const msg = event.getMessage();
        const channel = msg.getChannel();

        if (await msg.checkPermission("filter.ignore")) return;
        if (this.permits.hasChatter(msg.getChatter())) {
            const timestamp = this.permits.getChatter(msg.getChatter());
            const expires = timestamp.clone().add(await msg.getChannel().getSetting<string>("filter.permit-length"), "seconds");
            if (moment().isBefore(expires)) {
                return;
            } else {
                this.permits.removeChatter(msg.getChatter());
            }
        }
        const roles = await msg.getUserRoles();
        if (roles.indexOf(Role.REGULAR) >= 0) return;
        if (roles.indexOf(Role.SUBSCRIBER) >= 0 &&
            await msg.getChannel().getSettings().get("filter.ignore-subs")) return;
        if (roles.indexOf(Role.VIP) >= 0 &&
            await msg.getChannel().getSettings().get("filter.ignore-vips")) return;
        if (roles.indexOf(Role.PREMIUM) >= 0 &&
            await msg.getChannel().getSettings().get("filter.ignore-premium")) return;
        if (getMaxRole(roles) >= Role.MODERATOR) return;

        const lists = await FiltersEntity.getByChannel(channel);

        const noDot = msg.getRaw().replace(DOT, ".");
        const whitelistUrl = await msg.getChannel().getSettings().get("filter.urls.whitelist");
        while (true) {
            const res = URL_PATTERN.exec(noDot);
            if (res === null) break;
            const domain = res[3];

            if (whitelistUrl ? !array_contains(domain, lists.domains) : array_contains(domain, lists.domains)) {
                await this.nextStrike(Key("filter.reasons.url"), msg);
                return;
            }
        }

        if (await msg.getChannel().getSettings().get("filter.caps.enabled")) {
            const amount = (msg.getRaw().match(CAPS_PATTERN) || []).length;
            if (amount >= await msg.getChannel().getSettings().get("filter.caps.amount")) {
                await this.nextStrike(Key("filter.reasons.caps"), msg);
                return;
            }
        }

        if (await msg.getChannel().getSettings().get("filter.spam.enabled")) {
            // TODO: Add spam filter
        }

        if (await msg.getChannel().getSettings().get("filter.symbols.enabled")) {
            const amount = (msg.getRaw().match(SYMBOLS_PATTERN) || []).length;
            if (amount >= await msg.getChannel().getSettings().get("filter.symbols.amount")) {
                await this.nextStrike(Key("filter.reasons.symbols"), msg);
                return;
            }
        }

        if (await msg.getChannel().getSettings().get("filter.emotes.enabled")) {
            const badWords = lists.emotes;
            const lower = msg.getRaw().toLowerCase();
            const whitelist = await msg.getChannel().getSettings().get("filter.emotes.whitelist");
            for (const badWord of badWords) {
                if (whitelist ? lower.indexOf(badWord.toLowerCase()) < 0 : lower.indexOf(badWord.toLowerCase()) >= 0) {
                    await this.nextStrike(Key("filter.reasons.emote.blacklisted"), msg);
                    return;
                }
            }

            if (msg instanceof TwitchMessage) {
                const amount = Object.values(msg.getUserState().emotes).reduce<number>((previous, next) => {
                    return previous + next.length;
                }, 0);
                if (amount >= await msg.getChannel().getSettings().get("filter.emotes.amount")) {
                    await this.nextStrike(Key("filter.reasons.emote.too_many"), msg);
                    return;
                }
            }
        }

        if (await msg.getChannel().getSettings().get("filter.fake-purge.enabled")) {
            if (FAKE_PURGE.test(msg.getRaw())) {
                await this.nextStrike(Key("filter.reasons.fake_purge"), msg);
                return;
            }
        }

        if (await msg.getChannel().getSettings().get("filter.bad-word.enabled")) {
            const badWords = lists.badWords;
            const lower = msg.getRaw().toLowerCase();
            for (const badWord of badWords) {
                if (lower.indexOf(badWord.toLowerCase()) >= 0) {
                    await this.nextStrike(Key("filter.reasons.bad_word"), msg);
                    return;
                }
            }
        }

        if (await msg.getChannel().getSettings().get("filter.long-message.enabled")) {
            if (msg.getRaw().length >= await msg.getChannel().getSettings().get("filter.long-message.length")) {
                await this.nextStrike(Key("filter.reasons.long_message"), msg);
                return;
            }
        }
    }

    async nextStrike(reasonKey: TranslationKey, msg: Message): Promise<void> {
        const strike = (this.strikes.getChatter(msg.getChatter()) + 1) % 4;
        this.strikes.setChatter(msg.getChatter(), strike);
        const reason = msg.getResponse().translate(reasonKey);

        await msg.getResponse().message(Key("filter.strike"), msg.getChatter().name, reason, strike);
    }
}