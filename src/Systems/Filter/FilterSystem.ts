import StrikeManager from "./StrikeManager";
import Filter from "./Filters/Filter";
import SpamFilter from "./Filters/SpamFilter";
import LongMessageFilter from "./Filters/LongMessageFilter";
import BadWordFilter from "./Filters/BadWordFilter";
import CapsFilter from "./Filters/CapsFilter";
import EmoteFilter from "./Filters/EmoteFilter";
import FakePurgeFilter from "./Filters/FakePurgeFilter";
import SymbolFilter from "./Filters/SymbolFilter";
import UrlFilter from "./Filters/UrlFilter";
import {EventHandler, HandlesEvents} from "../Event/decorators";
import MessageEvent, {MessageEventArgs} from "../../Chat/Events/MessageEvent";
import PermissionSystem from "../Permissions/PermissionSystem";
import Permission from "../Permissions/Permission";
import {Role} from "../Permissions/Role";
import ChatterEntity, {ChatterStateList} from "../../Database/Entities/ChatterEntity";
import moment from "moment";
import System from "../System";
import MessageCache from "./MessageCache";
import ChannelEntity from "../../Database/Entities/ChannelEntity";

@HandlesEvents()
export default class FilterSystem extends System {
    private static instance: FilterSystem = null;

    public static getInstance(): FilterSystem {
        if (this.instance === null)
            this.instance = new FilterSystem();

        return this.instance;
    }

    private readonly strikeManager: StrikeManager = new StrikeManager();
    private readonly permits: ChatterStateList<moment.Moment> = new ChatterStateList<moment.Moment>(null);
    private readonly filters: Filter[];
    private readonly messageCache: MessageCache = new MessageCache();

    constructor() {
        super("Filter");

        this.filters = [
            new BadWordFilter(this.strikeManager),
            new CapsFilter(this.strikeManager),
            new EmoteFilter(this.strikeManager),
            new FakePurgeFilter(this.strikeManager),
            new LongMessageFilter(this.strikeManager),
            new SpamFilter(this.strikeManager, this.messageCache),
            new SymbolFilter(this.strikeManager),
            new UrlFilter(this.strikeManager)
        ];

        const perm = PermissionSystem.getInstance();
        perm.registerPermission(new Permission("filter.ignore.all", Role.MODERATOR));

        this.logger.info("System initialized");
    }

    @EventHandler(MessageEvent)
    async onMessage(eventArgs: MessageEventArgs): Promise<void> {
        const { sender, channel, message } = eventArgs;
        await this.messageCache.add(message);
        if (await message.checkPermission("filter.ignore.all")) return;
        if (this.permits.hasChatter(sender)) {
            const timestamp = this.permits.getChatter(sender);
            const expires = timestamp.clone().add(await channel.getSetting<string>("filter.permit-length"), "seconds");
            if (moment().isBefore(expires))
                return;
            else
                this.permits.removeChatter(sender);
        }


        const lists = await eventArgs.channel.getFilters();

        for (const filter of this.filters)
            if (await filter.handleMessage(lists, eventArgs))
                break;
    }

    pardonUser(chatter: ChatterEntity) {
        this.strikeManager.pardonUser(chatter);
    }

    permitUser(chatter: ChatterEntity) {
        this.permits.setChatter(chatter, moment());
    }

    getCachedMessages(channel: ChannelEntity) {
        return this.messageCache.getAll(channel);
    }
}