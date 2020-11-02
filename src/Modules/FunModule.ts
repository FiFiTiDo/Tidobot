import AbstractModule, {Symbols} from "./AbstractModule";
import {arrayRand} from "../Utilities/ArrayUtils";
import Permission from "../Systems/Permissions/Permission";
import {Role} from "../Systems/Permissions/Role";
import Command from "../Systems/Commands/Command";
import {CommandEvent} from "../Systems/Commands/CommandEvent";
import Adapter from "../Adapters/Adapter";
import {ResponseArg, Sender} from "../Systems/Commands/Validation/Argument";
import {Response} from "../Chat/Response";
import {randomFloat} from "../Utilities/RandomUtils";
import {CommandHandler} from "../Systems/Commands/Validation/CommandHandler";
import CheckPermission from "../Systems/Commands/Validation/CheckPermission";
import {wait} from "../Utilities/functions";
import {TimeUnit} from "../Systems/Timer/TimerSystem";
import { Inject, Service } from "typedi";
import { AdapterToken } from "../symbols";
import { Chatter } from "../Database/Entities/Chatter";

export const MODULE_INFO = {
    name: "Fun",
    version: "1.2.0",
    description: "Just a bunch of fun things that don't fit in their own module"
};

@Service()
class RouletteCommand extends Command {
    constructor(@Inject(AdapterToken) private readonly adapter: Adapter) {
        super("roulette", null);
    }

    @CommandHandler("roulette", "roulette")
    @CheckPermission(() => FunModule.permissions.playRoulette)
    async handleCommand(event: CommandEvent, @ResponseArg response: Response, @Sender sender: Chatter): Promise<void> {
        await response.action("fun:roulette.lead_up", {username: sender.user.name});
        await wait(TimeUnit.Seconds(1));
        if (randomFloat() > 1 / 6) {
            await response.message("fun:roulette.safe", {username: sender.user.name});
        } else {
            await response.message("fun:roulette.hit", {username: sender.user.name});
            await this.adapter.tempbanChatter(sender, 60, await response.translate("fun:roulette.reason"));
        }
    }
}

@Service()
class SeppukuCommand extends Command {
    constructor(@Inject(AdapterToken) private readonly adapter: Adapter) {
        super("seppuku", null);
    }

    @CommandHandler("seppuku", "seppuku")
    @CheckPermission(() => FunModule.permissions.playSeppuku)
    async handleCommand(event: CommandEvent, @ResponseArg response: Response, @Sender sender: Chatter): Promise<void> {
        const successful = await this.adapter.tempbanChatter(sender, 30, await response.translate("fun:seppuku.reason"));
        if (!successful) await response.message("error.bot-not-permitted");
    }
}

@Service()
class Magic8BallCommand extends Command {
    constructor() {
        super("8ball", null);
    }

    @CommandHandler("8ball", "8ball")
    @CheckPermission(() => FunModule.permissions.play8Ball)
    async handleCommand(event: CommandEvent, @ResponseArg response: Response): Promise<void> {
        const resp = arrayRand(await response.getTranslation<string[]>("fun:8ball.responses"));
        await response.message("fun:8ball.response", {response: resp});
    }
}

@Service()
export default class FunModule extends AbstractModule {
    static [Symbols.ModuleInfo] = MODULE_INFO;
    static permissions = {
        playRoulette: new Permission("fun.roulette", Role.NORMAL),
        playSeppuku: new Permission("fun.seppuku", Role.NORMAL),
        play8Ball: new Permission("fun.8ball", Role.NORMAL)
    }

    constructor(
        rouletteCommand: RouletteCommand,
        seppukuCommand: SeppukuCommand,
        magic8ballCommand: Magic8BallCommand
    ) {
        super(FunModule);

        this.registerCommand(rouletteCommand);
        this.registerCommand(seppukuCommand);
        this.registerCommand(magic8ballCommand);
        this.registerPermissions(FunModule.permissions);
    }
}