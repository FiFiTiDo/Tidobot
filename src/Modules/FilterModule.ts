import AbstractModule from "./AbstractModule";
import MessageEvent from "../Chat/Events/MessageEvent";
import {ConfirmationFactory, ConfirmedEvent} from "./ConfirmationModule";
import moment from "moment";
import {TwitchMessage} from "../Services/Twitch/TwitchMessage";
import Message from "../Chat/Message";
import ChatterEntity, {ChatterStateList} from "../Database/Entities/ChatterEntity";
import FiltersEntity from "../Database/Entities/FiltersEntity";
import {array_add, array_contains, array_remove} from "../Utilities/ArrayUtils";
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
        await response.message("filter:permit", {
            username: chatter.name,
            second: await msg.getChannel().getSettings().get("filter.permit-length")
        });
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
        await response.message("filter:strikes-cleared", {username: chatter.name});
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
        await this.bot.tempbanChatter(chatter, await msg.getChannel().getSettings().get("filter.purge-length"),
            await response.translate("filter:purge-reason", {username: msg.getChatter().name}));
        await response.message("filter:purged", {username: chatter.name});
    }
}

class FilterCommand extends Command {
    constructor(private makeConfirmation: ConfirmationFactory) {
        super("filter", "<add|remove|reset>");

        this.addSubcommand("add", this.add);
        this.addSubcommand("remove", this.remove);
        this.addSubcommand("rem", this.remove);
        this.addSubcommand("reset", this.reset);
    }

    async add({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "filter add <list> <item>",
            arguments: [
                {
                    value: {
                        type: "string",
                        accepted: ["domains", "badWords", "emotes"]
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
        const [list, item] = args as ["domains" | "badWords" | "emotes", string];
        const lists = await msg.getChannel().getFilters();

        if (array_add(item, lists[list])) {
            try {
                await lists.save();
                await response.message("filter:list.added", {item, list});
            } catch (e) {
                await response.genericError();
            }
        } else
            await response.message("filter:list.exists", {list, item});
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
        const [list, item] = args as ["domains" | "bad_words" | "emotes", string];
        const lists = await msg.getChannel().getFilters();

        if (array_remove(item, lists[list])) {
            try {
                await lists.save();
                await response.message("filter:list.removed", {item, list});
            } catch (e) {
                await response.genericError();
            }
        } else
            await response.message("filter:list.unknown", {list, item});
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
        const [list] = args as ["domains" | "bad_words" | "emotes"];
        const lists = await msg.getChannel().getFilters();

        const confirmation = await this.makeConfirmation(msg, await response.translate(`filter:list.reset.confirm-${list ? "specific" : "all"}`), 30);
        confirmation.addListener(ConfirmedEvent, async () => {
            if (list) {
                lists[list] = [];

                await lists.save()
                    .then(() => response.message("filter:list.reset.specific", {list}))
                    .catch(() => response.genericError());
            } else {
                lists.badWords = [];
                lists.emotes = [];
                lists.domains = [];

                await lists.save()
                    .then(() => response.message("filter:list.reset.all"))
                    .catch(() => response.genericError());
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
        settings.registerSetting(new Setting("filter.permit-length", "30", SettingType.INTEGER));
        settings.registerSetting(new Setting("filter.purge-length", "1", SettingType.INTEGER));
    }

    @EventHandler(NewChannelEvent)
    async onNewChannel({channel}: NewChannelEventArgs): Promise<void> {
        await FiltersEntity.createForChannel(channel);
    }
}