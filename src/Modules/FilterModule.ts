import AbstractModule, {Symbols} from "./AbstractModule";
import {ConfirmationFactory, ConfirmedEvent} from "./ConfirmationModule";
import FiltersEntity from "../Database/Entities/FiltersEntity";
import {array_add, array_remove, tuple} from "../Utilities/ArrayUtils";
import {Role} from "../Systems/Permissions/Role";
import Permission from "../Systems/Permissions/Permission";
import Setting, {Integer, SettingType} from "../Systems/Settings/Setting";
import {NewChannelEvent, NewChannelEventArgs} from "../Chat/Events/NewChannelEvent";
import {EventHandler, HandlesEvents} from "../Systems/Event/decorators";
import {inject} from "inversify";
import symbols from "../symbols";
import Command from "../Systems/Commands/Command";
import {CommandEventArgs} from "../Systems/Commands/CommandEvent";
import FilterSystem from "../Systems/Filter/FilterSystem";
import {chatter as chatterConverter} from "../Systems/Commands/Validation/Chatter";
import {string} from "../Systems/Commands/Validation/String";
import StandardValidationStrategy from "../Systems/Commands/Validation/Strategies/StandardValidationStrategy";
import {ValidatorStatus} from "../Systems/Commands/Validation/Strategies/ValidationStrategy";
import Adapter from "../Adapters/Adapter";
import {getLogger, logError} from "../Utilities/Logger";
import {removePrefix} from "../Utilities/StringUtils";
import picomatch from "picomatch";
import {command, Subcommand} from "../Systems/Commands/decorators";
import {permission} from "../Systems/Permissions/decorators";
import {setting} from "../Systems/Settings/decorators";

export const MODULE_INFO = {
    name: "Filter",
    version: "1.1.2",
    description: "Manage the filtering system used to filter out unwanted messages automatically"
};

const logger = getLogger(MODULE_INFO.name);

class NukeCommand extends Command {
    constructor(private filterModule: FilterModule) {
        super("nuke", "[--regex] <match>");
    }

    async execute({ event, channel, response }: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "nuke [--regex] <match>",
            arguments: tuple(
                string({ name: "match", required: true, greedy: true })
            ),
            permission: this.filterModule.nuke
        }));
        if (status !== ValidatorStatus.OK) return;
        let match = args[0];

        const { newString, removed } = removePrefix("--regex ", match);
        const regex = removed ? new RegExp(newString) : picomatch.compileRe(picomatch.parse(newString, {}) as any);
        const matches = (input: string): boolean => picomatch.test(input, regex).isMatch;
        const cached = FilterSystem.getInstance().getCachedMessages(channel);
        let purged = 0;

        for (const message of cached) {
            if (matches(message.getRaw())) {
                try {
                    await this.filterModule.adapter.tempbanChatter(message.getChatter(),
                        await message.getChannel().getSetting(this.filterModule.purgeLength),
                        await response.translate("filter:nuke-reason", {username: message.getChatter().name})
                    );
                    purged++;
                } catch (e) {
                    logError(logger, e, "Unable to purge message");
                }
            }
        }

        await response.message("filter:nuked", { count: purged });
    }
}

class PermitCommand extends Command {
    constructor(private filterModule: FilterModule) {
        super("permit", "<user>");
    }

    async execute({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "permit <user>",
            arguments: tuple(
                chatterConverter({ name: "user", required: true }),
            ),
            permission: this.filterModule.permitUser
        }));
         if (status !== ValidatorStatus.OK) return;
        const [chatter] = args;

        FilterSystem.getInstance().permitUser(chatter);
        await response.message("filter:permit", {
            username: chatter.name,
            second: await msg.getChannel().getSetting(this.filterModule.permitLength)
        });
    }
}

class PardonCommand extends Command {
    constructor(private filterModule: FilterModule) {
        super("pardon", "<user>");
    }

    async execute({event, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "pardon <user>",
            arguments: tuple(
                chatterConverter({ name: "user", required: true })
            ),
            permission: this.filterModule.pardonUser
        }));
         if (status !== ValidatorStatus.OK) return;
        const [chatter] = args;

        FilterSystem.getInstance().pardonUser(chatter);
        await response.message("filter:strikes-cleared", {username: chatter.name});
    }
}

class PurgeCommand extends Command {
    constructor(private filterModule: FilterModule) {
        super("purge", "<user>");
    }

    async execute({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "purge <user>",
            arguments: tuple(
                chatterConverter({ name: "user", required: true })
            ),
            permission: this.filterModule.purgeUser
        }));
         if (status !== ValidatorStatus.OK) return;
        const [chatter] = args;
        await this.filterModule.adapter.tempbanChatter(chatter, await msg.getChannel().getSetting(this.filterModule.purgeLength),
            await response.translate("filter:purge-reason", {username: msg.getChatter().name}));
        await response.message("filter:purged", {username: chatter.name});
    }
}

class FilterCommand extends Command {
    constructor(private filterModule: FilterModule) {
        super("filter", "<add|remove|reset>");
    }

    @Subcommand("add")
    async add({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "filter add <list> <item>",
            subcommand: "add",
            arguments: tuple(
                string({ name: "list", required: true, accepted: ["domains", "badWords", "emotes"]}),
                string({ name: "item", required: true, greedy: true })
            ),
            permission: this.filterModule.addList
        }));
         if (status !== ValidatorStatus.OK) return;
        const [list, item] = args;
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

    @Subcommand("remove", "rem")
    async remove({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "filter remove <list> <item>",
            subcommand: "remove",
            arguments: tuple(
                string({ name: "list", required: true, accepted: ["domains", "badWords", "emotes"]}),
                string({ name: "item", required: true, greedy: true })
            ),
            permission: this.filterModule.removeList
        }));
         if (status !== ValidatorStatus.OK) return;
        const [list, item] = args;
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

    @Subcommand("reset")
    async reset({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "filter reset [list]",
            subcommand: "reset",
            arguments: tuple(
                string({ name: "list", required: true, accepted: ["domains", "badWords", "emotes"]})
            ),
            permission: this.filterModule.resetList
        }));
         if (status !== ValidatorStatus.OK) return;
        const [list] = args;
        const lists = await msg.getChannel().getFilters();

        const confirmation = await this.filterModule.makeConfirmation(msg, await response.translate(`filter:list.reset.confirm-${list ? "specific" : "all"}`), 30);
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
    static [Symbols.ModuleInfo] = MODULE_INFO;

    constructor(@inject(Adapter) public adapter: Adapter, @inject(symbols.ConfirmationFactory) public makeConfirmation: ConfirmationFactory) {
        super(FilterModule);
    }

    @command permitCommand = new PermitCommand(this);
    @command pardonCommand = new PardonCommand(this);
    @command purgeCommand = new PurgeCommand(this);
    @command filterCommand = new FilterCommand(this);
    @command nukeCommand = new NukeCommand(this);

    @permission ignoreFilter = new Permission("filter.ignore", Role.MODERATOR);
    @permission permitUser = new Permission("filter.permit", Role.MODERATOR);
    @permission pardonUser = new Permission("filter.pardon", Role.MODERATOR);
    @permission purgeUser = new Permission("filter.purge", Role.MODERATOR);
    @permission addList = new Permission("filter.list.add", Role.MODERATOR);
    @permission removeList = new Permission("filter.list.remove", Role.MODERATOR);
    @permission resetList = new Permission("filter.list.reset", Role.MODERATOR);
    @permission nuke = new Permission("filter.nuke", Role.MODERATOR);

    @setting permitLength = new Setting("filter.permit-length", 30 as Integer, SettingType.INTEGER);
    @setting purgeLength = new Setting("filter.purge-length", 1 as Integer, SettingType.INTEGER);

    @EventHandler(NewChannelEvent)
    async onNewChannel({channel}: NewChannelEventArgs): Promise<void> {
        await FiltersEntity.createForChannel(channel);
    }
}