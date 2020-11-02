import StrikeManager from "./StrikeManager";
import Filter from "./Filters/Filter";
import SpamFilter from "./Filters/SpamFilter";
import LongMessageFilter from "./Filters/LongMessageFilter";
import BadWordFilter from "./Filters/BadWordFilter";
import CapsFilter from "./Filters/CapsFilter";
import FakePurgeFilter from "./Filters/FakePurgeFilter";
import SymbolFilter from "./Filters/SymbolFilter";
import UrlFilter from "./Filters/UrlFilter";
import {EventHandler, HandlesEvents} from "../Event/decorators";
import MessageEvent, {MessageEventArgs} from "../../Chat/Events/MessageEvent";
import Permission from "../Permissions/Permission";
import {Role} from "../Permissions/Role";
import moment from "moment";
import System from "../System";
import MessageCache from "./MessageCache";
import {SettingType} from "../Settings/Setting";
import RepetitionFilter from "./Filters/RepetitionFilter";
import { Service } from "typedi";
import { EntityStateList } from "../../Database/EntityStateLiist";
import { Channel } from "../../Database/Entities/Channel";
import { Chatter } from "../../Database/Entities/Chatter";
import PermissionSystem from "../Permissions/PermissionSystem";

@HandlesEvents()
@Service()
export default class FilterSystem extends System {
    private readonly strikeManager: StrikeManager = new StrikeManager();
    private readonly permits: EntityStateList<Chatter, moment.Moment> = new EntityStateList<Chatter, moment.Moment>(null);
    private readonly filters: Filter[];
    private readonly messageCache: MessageCache = new MessageCache();

    constructor(
        badWordFilter: BadWordFilter, capsFilter: CapsFilter, fakePurgeFilter: FakePurgeFilter,
        longMessageFilter: LongMessageFilter, spamFilter: SpamFilter, symbolFilter: SymbolFilter, urlFilter: UrlFilter,
        repetitionFilter: RepetitionFilter, perm: PermissionSystem
    ) {
        super("Filter");

        this.filters = [
            badWordFilter, capsFilter, fakePurgeFilter, longMessageFilter, spamFilter, symbolFilter, urlFilter, repetitionFilter
        ];

        perm.registerPermission(new Permission("filter.ignore.all", Role.MODERATOR));

        this.logger.info("System initialized");
    }

    @EventHandler(MessageEvent)
    async onMessage(eventArgs: MessageEventArgs): Promise<void> {
        const {sender, channel, message} = eventArgs;
        this.messageCache.add(message);
        if (await message.checkPermission("filter.ignore.all")) return;
        if (this.permits.has(sender)) {
            const timestamp = this.permits.get(sender);
            const expires = timestamp.clone().add(channel.settings.get<SettingType.STRING>("filter.permit-length"), "seconds");
            if (moment().isBefore(expires))
                return;
            else
                this.permits.delete(sender);
        }



        for (const filter of this.filters)
            if (await filter.handleMessage(eventArgs))
                break;
    }

    pardonUser(chatter: Chatter) {
        this.strikeManager.pardonUser(chatter);
    }

    permitUser(chatter: Chatter) {
        this.permits.set(chatter, moment());
    }

    getCachedMessages(channel: Channel) {
        return this.messageCache.getAll(channel);
    }
}