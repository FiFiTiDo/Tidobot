import AbstractModule, {Symbols} from "./AbstractModule";
import MessageEvent from "../Chat/Events/MessageEvent";
import ChannelEntity from "../Database/Entities/ChannelEntity";
import {Role} from "../Systems/Permissions/Role";
import Permission from "../Systems/Permissions/Permission";
import Setting, {Float, Integer, SettingType} from "../Systems/Settings/Setting";
import {EventArguments} from "../Systems/Event/Event";
import {EventHandler, HandlesEvents} from "../Systems/Event/decorators";
import Command from "../Systems/Commands/Command";
import {CommandEvent} from "../Systems/Commands/CommandEvent";
import {getLogger} from "../Utilities/Logger";
import {command} from "../Systems/Commands/decorators";
import {permission} from "../Systems/Permissions/decorators";
import {setting} from "../Systems/Settings/decorators";
import {wait} from "../Utilities/functions";
import {RaffleService} from "../Services/RaffleService";
import {CommandHandler} from "../Systems/Commands/Validation/CommandHandler";
import CheckPermission from "../Systems/Commands/Validation/CheckPermission";
import {Channel, ResponseArg, RestArguments} from "../Systems/Commands/Validation/Argument";
import {Response} from "../Chat/Response";

export const MODULE_INFO = {
    name: "Raffle",
    version: "1.1.1",
    description: "Run a raffle to randomly select users from the chat who entered the specified keyword"
};

const logger = getLogger(MODULE_INFO.name);

class RaffleCommand extends Command {

    constructor(private readonly raffleModule: RaffleModule) {
        super("raffle", "<open|close|reset|pull>");
    }

    @CommandHandler("raffle open", "raffle open <keyword>", 1)
    @CheckPermission("raffle.open")
    async open(
        event: CommandEvent, @ResponseArg response: Response, @Channel channel: ChannelEntity,
        @RestArguments(true, { join: " " }) keyword: string
    ): Promise<void> {
        const raffle = this.raffleModule.raffleService.openRaffle(keyword, channel, {
            price: await channel.getSetting(this.raffleModule.price),
            maxEntries: await channel.getSetting(this.raffleModule.maxEntries),
            duplicateWins: await channel.getSetting(this.raffleModule.duplicateWins)
        });

        return raffle.present ?
            await response.message("raffle:opened", {keyword}) :
            await response.message("raffle:error.already-open");
    }

    @CommandHandler("raffle close", "raffle close", 1)
    @CheckPermission("raffle.close")
    async close(event: CommandEvent, @ResponseArg response: Response, @Channel channel: ChannelEntity): Promise<void> {
        this.raffleModule.raffleService.closeRaffle(channel).ifPresent(() => response.message("raffle:closed"));
    }

    @CommandHandler("raffle reset", "raffle reset", 1)
    @CheckPermission("raffle.reset")
    async reset(event: CommandEvent, @ResponseArg response: Response, @Channel channel: ChannelEntity): Promise<void> {
        this.raffleModule.raffleService.resetRaffle(channel).ifPresent(() => response.message("raffle:reset"));
    }

    @CommandHandler(/^raffle (pull|draw)/, "raffle pull", 1)
    @CheckPermission("raffle.pull")
    async pull(event: CommandEvent, @ResponseArg response: Response, @Channel channel: ChannelEntity): Promise<void> {
        this.raffleModule.raffleService.pullWinner(channel).ifPresent(async value => {
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
    readonly raffleService: RaffleService = new RaffleService();

    constructor() {
        super(RaffleModule);
    }

    @command raffleCommand = new RaffleCommand(this);

    @permission openRaffle = new Permission("raffle.open", Role.MODERATOR);
    @permission closeRaffle = new Permission("raffle.close", Role.MODERATOR);
    @permission resetRaffle = new Permission("raffle.reset", Role.MODERATOR);
    @permission pullWinner = new Permission("raffle.pull", Role.MODERATOR);
    @permission enterRaffle = new Permission("raffle.enter", Role.NORMAL);

    @setting price = new Setting("raffle.price", 0.0 as Float, SettingType.FLOAT);
    @setting maxEntries = new Setting("raffle.max-entries", 1 as Integer, SettingType.INTEGER);
    @setting duplicateWins = new Setting("raffle.duplicate-wins", false, SettingType.BOOLEAN);

    @EventHandler(MessageEvent)
    async handleMessage({event}: EventArguments<MessageEvent>): Promise<void> {
        const message = event.getMessage();

        if (this.isDisabled(message.getChannel())) return;
        await this.raffleService.tryEnter(message);
    }
}