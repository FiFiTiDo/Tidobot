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

@HandlesEvents()
export default class FilterSystem {
    private readonly strikeManager: StrikeManager;
    private readonly filters: Filter[];

    constructor() {
        this.strikeManager = new StrikeManager();
        this.filters = [
            new BadWordFilter(this.strikeManager),
            new CapsFilter(this.strikeManager),
            new EmoteFilter(this.strikeManager),
            new FakePurgeFilter(this.strikeManager),
            new LongMessageFilter(this.strikeManager),
            new SpamFilter(this.strikeManager),
            new SymbolFilter(this.strikeManager),
            new UrlFilter(this.strikeManager)
        ];

        const perm = PermissionSystem.getInstance();
        perm.registerPermission(new Permission("filter.ignore.all", Role.MODERATOR));
    }

    @EventHandler(MessageEvent)
    async onMessage(eventArgs: MessageEventArgs): Promise<void> {
        if (await eventArgs.message.checkPermission("filter.ignore.all")) return;

        const lists = await eventArgs.channel.getFilters();

        for (const filter of this.filters)
            if (await filter.handleMessage(lists, eventArgs))
                break;
    }
}