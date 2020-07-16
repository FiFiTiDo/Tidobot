import AbstractModule, {Symbols} from "./AbstractModule";
import {ConfirmationFactory, ConfirmedEvent} from "./ConfirmationModule";
import FiltersEntity from "../Database/Entities/FiltersEntity";
import {array_add, array_remove} from "../Utilities/ArrayUtils";
import {Role} from "../Systems/Permissions/Role";
import Permission from "../Systems/Permissions/Permission";
import Setting, {Integer, SettingType} from "../Systems/Settings/Setting";
import {NewChannelEvent, NewChannelEventArgs} from "../Chat/Events/NewChannelEvent";
import {EventHandler, HandlesEvents} from "../Systems/Event/decorators";
import {inject} from "inversify";
import symbols from "../symbols";
import Command from "../Systems/Commands/Command";
import {CommandEvent} from "../Systems/Commands/CommandEvent";
import FilterSystem from "../Systems/Filter/FilterSystem";
import {ChatterConverter} from "../Systems/Commands/Validation/Chatter";
import {StringEnumConverter} from "../Systems/Commands/Validation/String";
import Adapter from "../Adapters/Adapter";
import {getLogger, logError} from "../Utilities/Logger";
import {removePrefix} from "../Utilities/StringUtils";
import picomatch from "picomatch";
import {command} from "../Systems/Commands/decorators";
import {permission} from "../Systems/Permissions/decorators";
import {setting} from "../Systems/Settings/decorators";
import {CommandHandler} from "../Systems/Commands/Validation/CommandHandler";
import {
    Argument,
    Channel,
    MessageArg,
    ResponseArg,
    RestArguments,
    Sender
} from "../Systems/Commands/Validation/Argument";
import {Response} from "../Chat/Response";
import CheckPermission from "../Systems/Commands/Validation/CheckPermission";
import ChannelEntity from "../Database/Entities/ChannelEntity";
import ChatterEntity from "../Database/Entities/ChatterEntity";
import Message from "../Chat/Message";

export const MODULE_INFO = {
    name: "Filter",
    version: "1.2.0",
    description: "Manage the filtering system used to filter out unwanted messages automatically"
};

const logger = getLogger(MODULE_INFO.name);

class NukeCommand extends Command {
    constructor(private filterModule: FilterModule) {
        super("nuke", "[--regex] <match>");
    }

    @CommandHandler("nuke", "nuke [--regex] <match>")
    @CheckPermission("filter.nuke")
    async handleCommand(
        event: CommandEvent, @ResponseArg response: Response, @Channel channel: ChannelEntity,
        @RestArguments(true, true) match: string
    ): Promise<void> {
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

    @CommandHandler("permit", "permit <user>")
    @CheckPermission("filter.permit")
    async handleCommand(
        event: CommandEvent, @ResponseArg response: Response, @Channel channel: ChannelEntity,
        @Argument(new ChatterConverter()) chatter: ChatterEntity
    ): Promise<void> {
        FilterSystem.getInstance().permitUser(chatter);
        await response.message("filter:permit", {
            username: chatter.name, second: await channel.getSetting(this.filterModule.permitLength)
        });
    }
}

class PardonCommand extends Command {
    constructor() {
        super("pardon", "<user>");
    }

    @CommandHandler("pardon", "pardon <user>")
    @CheckPermission("filter.pardon")
    async handleCommand(
        event: CommandEvent, @ResponseArg response: Response, @Argument(new ChatterConverter()) chatter: ChatterEntity
    ): Promise<void> {
        FilterSystem.getInstance().pardonUser(chatter);
        return response.message("filter:strikes-cleared", {username: chatter.name});
    }
}

class PurgeCommand extends Command {
    constructor(private filterModule: FilterModule) {
        super("purge", "<user>");
    }

    @CommandHandler("purge", "purge <user>")
    @CheckPermission("filter.purge")
    async handleCommand(
        event: CommandEvent, @ResponseArg response: Response, @Channel channel: ChannelEntity, @Sender sender: ChatterEntity,
        @Argument(new ChatterConverter()) chatter: ChatterEntity
    ): Promise<void> {
        await this.filterModule.adapter.tempbanChatter(chatter,
            await channel.getSetting(this.filterModule.purgeLength),
            await response.translate("filter:purge-reason", {username: sender.name})
        );
        await response.message("filter:purged", {username: chatter.name});
    }
}

const ListConverter = new StringEnumConverter(["domains", "badWords", "emotes"]);
class FilterCommand extends Command {
    constructor(private filterModule: FilterModule) {
        super("filter", "<add|remove|reset>");
    }

    @CommandHandler("list add", "list add <list> <item>", 1)
    @CheckPermission("filter.list.add")
    async add(
        event: CommandEvent, @ResponseArg response: Response, @Channel channel: ChannelEntity,
        @Argument(ListConverter) list: string, @RestArguments(true, true) item: string
    ): Promise<void> {
        const lists = await channel.getFilters();
        if (!array_add(item, lists[list])) return response.message("filter:list.exists", {list, item});
        return lists.save()
            .then(() => response.message("filter:list.added", {item, list}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^list (remove|rem)/, "list remove <list> <item>", 1)
    @CheckPermission("filter.list.remove")
    async remove(
        event: CommandEvent, @ResponseArg response: Response, @Channel channel: ChannelEntity,
        @Argument(ListConverter) list: string, @RestArguments(true, true) item: string
    ): Promise<void> {
        const lists = await channel.getFilters();
        if (!array_remove(item, lists[list])) return response.message("filter:list.unknown", {list, item});
        return lists.save()
            .then(() => response.message("filter:list.removed", {item, list}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler("list reset", "list reset <list>", 1)
    @CheckPermission("filter.list.reset")
    async reset(
        event: CommandEvent, @ResponseArg response: Response, @Channel channel: ChannelEntity, @MessageArg msg: Message,
        @Argument(ListConverter, "list", false) list: string
    ): Promise<void> {
        const lists = await channel.getFilters();

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
    @command pardonCommand = new PardonCommand();
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