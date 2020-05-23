import AbstractModule, {ModuleInfo, Systems} from "./AbstractModule";
import {ConfirmationFactory, ConfirmedEvent} from "./ConfirmationModule";
import moment from "moment";
import {ChatterStateList} from "../Database/Entities/ChatterEntity";
import FiltersEntity from "../Database/Entities/FiltersEntity";
import {array_add, array_remove, tuple} from "../Utilities/ArrayUtils";
import {Role} from "../Systems/Permissions/Role";
import Permission from "../Systems/Permissions/Permission";
import Setting, {SettingType} from "../Systems/Settings/Setting";
import {NewChannelEvent, NewChannelEventArgs} from "../Chat/Events/NewChannelEvent";
import {EventHandler, HandlesEvents} from "../Systems/Event/decorators";
import {inject} from "inversify";
import symbols from "../symbols";
import Command from "../Systems/Commands/Command";
import {CommandEventArgs} from "../Systems/Commands/CommandEvent";
import FilterSystem from "../Systems/Filter/FilterSystem";
import {chatter as chatterConverter} from "../Systems/Commands/Validator/Chatter";
import {string} from "../Systems/Commands/Validator/String";
import StandardValidationStrategy from "../Systems/Commands/Validator/Strategies/StandardValidationStrategy";
import {ValidatorStatus} from "../Systems/Commands/Validator/Strategies/ValidationStrategy";
import Adapter from "../Services/Adapter";
import {getLogger} from "log4js";

export const MODULE_INFO = {
    name: "Filter",
    version: "1.0.0",
    description: "Manage the filtering system used to filter out unwanted messages automatically"
};

const logger = getLogger(MODULE_INFO.name);

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
            permission: "filter.permit"
        }));
         if (status !== ValidatorStatus.OK) return;
        const [chatter] = args;

        FilterSystem.getInstance().permitUser(chatter);
        this.filterModule.permits.setChatter(chatter, moment());
        await response.message("filter:permit", {
            username: chatter.name,
            second: await msg.getChannel().getSettings().get("filter.permit-length")
        });
    }
}

class PardonCommand extends Command {
    constructor() {
        super("pardon", "<user>");
    }

    async execute({event, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "pardon <user>",
            arguments: tuple(
                chatterConverter({ name: "user", required: true })
            ),
            permission: "filter.pardon"
        }));
         if (status !== ValidatorStatus.OK) return;
        const [chatter] = args;

        FilterSystem.getInstance().pardonUser(chatter);
        await response.message("filter:strikes-cleared", {username: chatter.name});
    }
}

class PurgeCommand extends Command {
    constructor(private adapter: Adapter) {
        super("purge", "<user>");
    }

    async execute({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "purge <user>",
            arguments: tuple(
                chatterConverter({ name: "user", required: true })
            ),
            permission: "filter.purge"
        }));
         if (status !== ValidatorStatus.OK) return;
        const [chatter] = args;
        await this.adapter.tempbanChatter(chatter, await msg.getChannel().getSettings().get("filter.purge-length"),
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
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "filter add <list> <item>",
            arguments: tuple(
                string({ name: "list", required: true, accepted: ["domains", "badWords", "emotes"]}),
                string({ name: "item", required: true, greedy: true })
            ),
            permission: "filter.list.add"
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

    async remove({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "filter remove <list> <item>",
            arguments: tuple(
                string({ name: "list", required: true, accepted: ["domains", "badWords", "emotes"]}),
                string({ name: "item", required: true, greedy: true })
            ),
            permission: "filter.list.remove"
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

    async reset({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "filter reset [list]",
            arguments: tuple(
                string({ name: "list", required: true, accepted: ["domains", "badWords", "emotes"]})
            ),
            permission: "filter.list.add"
        }));
         if (status !== ValidatorStatus.OK) return;
        const [list] = args;
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

    constructor(@inject(Adapter) private adapter: Adapter, @inject(symbols.ConfirmationFactory) private makeConfirmation: ConfirmationFactory) {
        super(FilterModule.name);

        this.permits = new ChatterStateList(null);
        this.strikes = new ChatterStateList(0);
    }

    initialize({ command, permission, settings }: Systems): ModuleInfo {
        command.registerCommand(new PermitCommand(this), this);
        command.registerCommand(new PardonCommand(), this);
        command.registerCommand(new PurgeCommand(this.adapter), this);
        command.registerCommand(new FilterCommand(this.makeConfirmation), this);
        permission.registerPermission(new Permission("filter.ignore", Role.MODERATOR));
        permission.registerPermission(new Permission("filter.permit", Role.MODERATOR));
        permission.registerPermission(new Permission("filter.list.add", Role.MODERATOR));
        permission.registerPermission(new Permission("filter.list.remove", Role.MODERATOR));
        permission.registerPermission(new Permission("filter.list.reset", Role.MODERATOR));
        permission.registerPermission(new Permission("filter.pardon", Role.MODERATOR));
        permission.registerPermission(new Permission("filter.purge", Role.MODERATOR));
        settings.registerSetting(new Setting("filter.permit-length", "30", SettingType.INTEGER));
        settings.registerSetting(new Setting("filter.purge-length", "1", SettingType.INTEGER));

        return MODULE_INFO;
    }

    @EventHandler(NewChannelEvent)
    async onNewChannel({channel}: NewChannelEventArgs): Promise<void> {
        await FiltersEntity.createForChannel(channel);
    }
}