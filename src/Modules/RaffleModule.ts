import AbstractModule, {Symbols} from "./AbstractModule";
import MessageEvent from "../Chat/Events/MessageEvent";
import {Role} from "../Systems/Permissions/Role";
import Permission from "../Systems/Permissions/Permission";
import Setting, {Float, Integer, SettingType} from "../Systems/Settings/Setting";
import {EventHandler, HandlesEvents} from "../Systems/Event/decorators";
import Command from "../Systems/Commands/Command";
import {wait} from "../Utilities/functions";
import {RaffleService} from "../Services/RaffleService";
import {CommandHandler} from "../Systems/Commands/Validation/CommandHandler";
import CheckPermission from "../Systems/Commands/Validation/CheckPermission";
import {ChannelArg, ResponseArg, RestArguments} from "../Systems/Commands/Validation/Argument";
import {Response} from "../Chat/Response";
import { Service } from "typedi";
import { Channel } from "../Database/Entities/Channel";
import Event from "../Systems/Event/Event";

export const MODULE_INFO = {
    name: "Raffle",
    version: "1.2.0",
    description: "Run a raffle to randomly select users from the chat who entered the specified keyword"
};

@Service()
class RaffleCommand extends Command {

    constructor(private readonly raffleService: RaffleService) {
        super("raffle", "<open|close|reset|pull>");
    }

    @CommandHandler("raffle open", "raffle open <keyword>", 1)
    @CheckPermission(() => RaffleModule.permissions.openRaffle)
    async open(
        event: Event, @ResponseArg response: Response, @ChannelArg channel: Channel,
        @RestArguments(true, {join: " "}) keyword: string
    ): Promise<void> {
        const raffle = this.raffleService.openRaffle(keyword, channel, {
            price: channel.settings.get(RaffleModule.settings.price),
            maxEntries: channel.settings.get(RaffleModule.settings.maxEntries),
            duplicateWins: channel.settings.get(RaffleModule.settings.duplicateWins)
        });

        return raffle.present ?
            await response.message("raffle:opened", {keyword}) :
            await response.message("raffle:error.already-open");
    }

    @CommandHandler("raffle close", "raffle close", 1)
    @CheckPermission(() => RaffleModule.permissions.closeRaffle)
    async close(event: Event, @ResponseArg response: Response, @ChannelArg channel: Channel): Promise<void> {
        this.raffleService.closeRaffle(channel).ifPresent(() => response.message("raffle:closed"));
    }

    @CommandHandler("raffle reset", "raffle reset", 1)
    @CheckPermission(() => RaffleModule.permissions.resetRaffle)
    async reset(event: Event, @ResponseArg response: Response, @ChannelArg channel: Channel): Promise<void> {
        this.raffleService.resetRaffle(channel).ifPresent(() => response.message("raffle:reset"));
    }

    @CommandHandler(/^raffle (pull|draw)/, "raffle pull", 1)
    @CheckPermission(() => RaffleModule.permissions.pullWinner)
    async pull(event: Event, @ResponseArg response: Response, @ChannelArg channel: Channel): Promise<void> {
        this.raffleService.pullWinner(channel).ifPresent(async value => {
            if (value === false) return response.message("raffle:error.no-entries");

            await response.message("raffle:pull-lead-up");
            await wait(1000);
            await response.rawMessage("@" + value + "!!!");
        });
    }
}

@HandlesEvents()
export default class RaffleModule extends AbstractModule {
    static [Symbols.ModuleInfo] = MODULE_INFO;
    static permissions = {
        openRaffle: new Permission("raffle.open", Role.MODERATOR),
        closeRaffle: new Permission("raffle.close", Role.MODERATOR),
        resetRaffle: new Permission("raffle.reset", Role.MODERATOR),
        pullWinner: new Permission("raffle.pull", Role.MODERATOR),
        enterRaffle: new Permission("raffle.enter", Role.NORMAL)
    }
    static settings = {
        price: new Setting("raffle.price", 0.0 as Float, SettingType.FLOAT),
        maxEntries: new Setting("raffle.max-entries", 1 as Integer, SettingType.INTEGER),
        duplicateWins: new Setting("raffle.duplicate-wins", false, SettingType.BOOLEAN)
    }

    constructor(raffleCommand: RaffleCommand, private readonly raffleService: RaffleService) {
        super(RaffleModule);

        this.registerCommand(raffleCommand);
    }

    @EventHandler(MessageEvent)
    async handleMessage(event: Event): Promise<void> {
        const message = event.extra.get(MessageEvent.EXTRA_MESSAGE);

        if (this.isDisabled(message.getChannel())) return;
        await this.raffleService.tryEnter(message);
    }
}