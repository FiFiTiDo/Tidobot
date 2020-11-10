import AbstractModule, {Symbols} from "./AbstractModule";
import ConfirmationModule, {ConfirmedEvent} from "./ConfirmationModule";
import {Role} from "../Systems/Permissions/Role";
import Permission from "../Systems/Permissions/Permission";
import Setting, {Integer, SettingType} from "../Systems/Settings/Setting";
import {HandlesEvents} from "../Systems/Event/decorators";
import { AdapterToken } from "../symbols";
import Command from "../Systems/Commands/Command";
import FilterSystem from "../Systems/Filter/FilterSystem";
import {ChatterArg} from "../Systems/Commands/Validation/Chatter";
import {StringEnumArg} from "../Systems/Commands/Validation/String";
import Adapter from "../Adapters/Adapter";
import {getLogger, logError} from "../Utilities/Logger";
import {removePrefix} from "../Utilities/StringUtils";
import picomatch from "picomatch";
import {CommandHandler} from "../Systems/Commands/Validation/CommandHandler";
import {
    Argument,
    ChannelArg,
    MessageArg,
    ResponseArg,
    RestArguments,
    Sender
} from "../Systems/Commands/Validation/Argument";
import {Response} from "../Chat/Response";
import CheckPermission from "../Systems/Commands/Validation/CheckPermission";
import Message from "../Chat/Message";
import { Inject, Service } from "typedi";
import { Channel } from "../Database/Entities/Channel";
import { Chatter } from "../Database/Entities/Chatter";
import { InjectRepository } from "typeorm-typedi-extensions";
import { DomainFilterRepository } from "../Database/Repositories/DomainFilterRepository";
import { BadWordFilterRepository } from "../Database/Repositories/BadWordFilterRepository";
import { FilterRepository } from "../Database/Repositories/FilterRepository";
import Event from "../Systems/Event/Event";

export const MODULE_INFO = {
    name: "Filter",
    version: "1.3.0",
    description: "Manage the filtering system used to filter out unwanted messages automatically"
};

const logger = getLogger(MODULE_INFO.name);

@Service()
class NukeCommand extends Command {
    constructor(private readonly filterSystem: FilterSystem, @Inject(AdapterToken) private readonly adapter: Adapter) {
        super("nuke", "[--regex] <match>");
    }

    @CommandHandler("nuke", "nuke [--regex] <match>")
    @CheckPermission(() => FilterModule.permissions.nuke)
    async handleCommand(
        event: Event, @ResponseArg response: Response, @ChannelArg channel: Channel,
        @RestArguments(true, {join: " "}) match: string
    ): Promise<void> {
        const {newString, removed} = removePrefix("--regex ", match);
        const regex = removed ? new RegExp(newString) : picomatch.compileRe(picomatch.parse(newString, {}) as any);
        const matches = (input: string): boolean => picomatch.test(input, regex).isMatch;
        const cached = this.filterSystem.getCachedMessages(channel);
        let purged = 0;

        for (const message of cached) {
            if (matches(message.getRaw())) {
                try {
                    await this.adapter.tempbanChatter(message.getChatter(),
                        await message.channel.settings.get(FilterModule.settings.purgeLength),
                        await response.translate("filter:nuke-reason", {username: message.chatter.user.name})
                    );
                    purged++;
                } catch (e) {
                    logError(logger, e, "Unable to purge message");
                }
            }
        }

        await response.message("filter:nuked", {count: purged});
    }
}

@Service()
class PermitCommand extends Command {
    constructor(private readonly filterSystem: FilterSystem) {
        super("permit", "<user>");
    }

    @CommandHandler("permit", "permit <user>")
    @CheckPermission(() => FilterModule.permissions.permitUser)
    async handleCommand(
        event: Event, @ResponseArg response: Response, @ChannelArg channel: Channel,
        @Argument(new ChatterArg()) chatter: Chatter
    ): Promise<void> {
        this.filterSystem.permitUser(chatter);
        await response.message("filter:permit", {
            username: chatter.user.name, second: channel.settings.get(FilterModule.settings.permitLength)
        });
    }
}

@Service()
class PardonCommand extends Command {
    constructor(private readonly filterSystem: FilterSystem) {
        super("pardon", "<user>");
    }

    @CommandHandler("pardon", "pardon <user>")
    @CheckPermission(() => FilterModule.permissions.pardonUser)
    async handleCommand(
        event: Event, @ResponseArg response: Response, @Argument(new ChatterArg()) chatter: Chatter
    ): Promise<void> {
        this.filterSystem.pardonUser(chatter);
        return response.message("filter:strikes-cleared", {username: chatter.user.name});
    }
}

@Service()
class PurgeCommand extends Command {
    constructor(@Inject(AdapterToken) private readonly adapter: Adapter) {
        super("purge", "<user>");
    }

    @CommandHandler("purge", "purge <user>")
    @CheckPermission(() => FilterModule.permissions.purgeUser)
    async handleCommand(
        event: Event, @ResponseArg response: Response, @ChannelArg channel: Channel, @Sender sender: Chatter,
        @Argument(new ChatterArg()) chatter: Chatter
    ): Promise<void> {
        await this.adapter.tempbanChatter(chatter,
            channel.settings.get(FilterModule.settings.purgeLength),
            await response.translate("filter:purge-reason", {username: sender.user.name})
        );
        await response.message("filter:purged", {username: chatter.user.name});
    }
}

const LIST_TYPES = ["domain", "badword"] as const;
type ListType = typeof LIST_TYPES[number];
const ListConverter = new StringEnumArg(LIST_TYPES);

@Service()
class FilterCommand extends Command {
    constructor(
        private readonly confirmationModule: ConfirmationModule,
        @InjectRepository() private readonly domainFilterRepository: DomainFilterRepository,
        @InjectRepository() private readonly badWordFilterRepository: BadWordFilterRepository,
    ) {
        super("filter", "<add|remove|reset>");
    }

    private getRepository(list: ListType): FilterRepository<any> {
        switch (list) {
            case "domain": return this.domainFilterRepository;
            case "badword": return this.badWordFilterRepository;
        }
    }

    @CommandHandler("list add", "list add <list> <item>", 1)
    @CheckPermission(() => FilterModule.permissions.addList)
    async add(
        event: Event, @ResponseArg response: Response, @ChannelArg channel: Channel,
        @Argument(ListConverter) listType: ListType, @RestArguments(true, {join: " "}) item: string
    ): Promise<void> {
        this.getRepository(listType)
            .addValue(item, channel)
            .then(entity => {
                if (entity === null) {
                    return response.message("filter:list.exists", {list: listType, item});
                } else {
                    return response.message("filter:list.added", {item, list: listType});
                }
            })
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^list (remove|rem)/, "list remove <list> <item>", 1)
    @CheckPermission(() => FilterModule.permissions.removeList)
    async remove(
        event: Event, @ResponseArg response: Response, @ChannelArg channel: Channel,
        @Argument(ListConverter) listType: ListType, @RestArguments(true, {join: " "}) item: string
    ): Promise<void> {
        this.getRepository(listType)
            .removeValue(item, channel)
            .then(entity => {
                if (entity === null) {
                    return response.message("filter:list.unknown", {list: listType, item});
                } else {
                    return response.message("filter:list.removed", {item, list: listType});
                }
            })
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler("list reset", "list reset <list>", 1)
    @CheckPermission(() => FilterModule.permissions.resetList)
    async reset(
        event: Event, @ResponseArg response: Response, @ChannelArg channel: Channel, @MessageArg msg: Message,
        @Argument(ListConverter, "list", false) list: ListType
    ): Promise<void> {
        const confirmation = await this.confirmationModule.make(msg, await response.translate(`filter:list.reset.confirm-${list ? "specific" : "all"}`), 30);
        confirmation.addListener(ConfirmedEvent, async () => {
            if (list) {
                await this.getRepository(list)
                    .removeAll(channel)
                    .then(() => response.message("filter:list.reset.specific", {list}))
                    .catch(() => response.genericError());
            } else {
                try {
                    await this.domainFilterRepository.removeAll(channel);
                    await this.badWordFilterRepository.removeAll(channel);
                    await response.message("filter:list.reset.all");
                } catch {
                    await response.genericError();
                }
            }
        });
        confirmation.run();
    }
}

@HandlesEvents()
@Service()
export default class FilterModule extends AbstractModule {
    static [Symbols.ModuleInfo] = MODULE_INFO;
    static settings = {
        permitLength: new Setting("filter.permit-length", 30 as Integer, SettingType.INTEGER),
        purgeLength: new Setting("filter.purge-length", 1 as Integer, SettingType.INTEGER)
    }
    static permissions = {
        ignoreFilter: new Permission("filter.ignore", Role.MODERATOR),
        permitUser: new Permission("filter.permit", Role.MODERATOR),
        pardonUser: new Permission("filter.pardon", Role.MODERATOR),
        purgeUser: new Permission("filter.purge", Role.MODERATOR),
        addList: new Permission("filter.list.add", Role.MODERATOR),
        removeList: new Permission("filter.list.remove", Role.MODERATOR),
        resetList: new Permission("filter.list.reset", Role.MODERATOR),
        nuke: new Permission("filter.nuke", Role.MODERATOR)
    }

    constructor(
        @Inject(AdapterToken) public adapter: Adapter,
        permitCommand: PermitCommand,
        pardonCommand: PardonCommand,
        purgeCommand: PurgeCommand,
        filterCommand: FilterCommand,
        nukeCommand: NukeCommand
    ) {
        super(FilterModule);

        this.registerCommand(permitCommand);
        this.registerCommand(pardonCommand);
        this.registerCommand(purgeCommand);
        this.registerCommand(filterCommand);
        this.registerCommand(nukeCommand);
        this.registerSettings(FilterModule.settings);
        this.registerPermissions(FilterModule.permissions);
    }

}