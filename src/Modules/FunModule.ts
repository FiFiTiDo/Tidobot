import AbstractModule, {Symbols} from "./AbstractModule";
import {array_rand} from "../Utilities/ArrayUtils";
import Permission from "../Systems/Permissions/Permission";
import {Role} from "../Systems/Permissions/Role";
import {inject} from "inversify";
import Command from "../Systems/Commands/Command";
import {CommandEvent} from "../Systems/Commands/CommandEvent";
import StandardValidationStrategy from "../Systems/Commands/Validation/Strategies/StandardValidationStrategy";
import {ValidatorStatus} from "../Systems/Commands/Validation/Strategies/ValidationStrategy";
import Adapter from "../Adapters/Adapter";
import {getLogger} from "../Utilities/Logger";
import {command} from "../Systems/Commands/decorators";
import {permission} from "../Systems/Permissions/decorators";
import {ResponseArg, Sender} from "../Systems/Commands/Validation/Argument";
import {Response} from "../Chat/Response";
import ChatterEntity from "../Database/Entities/ChatterEntity";
import {randomFloat} from "../Utilities/RandomUtils";
import {CommandHandler} from "../Systems/Commands/Validation/CommandHandler";
import CheckPermission from "../Systems/Commands/Validation/CheckPermission";

export const MODULE_INFO = {
    name: "Fun",
    version: "1.1.0",
    description: "Just a bunch of fun things that don't fit in their own module"
};

const logger = getLogger(MODULE_INFO.name);

class RouletteCommand extends Command {
    constructor(private funModule: FunModule) {
        super("roulette", null);
    }

    @CommandHandler("roulette", "roulette")
    @CheckPermission("fun.roulette")
    async handleCommand(event: CommandEvent, @ResponseArg response: Response, @Sender sender: ChatterEntity): Promise<void> {
        const {status} = await event.validate(new StandardValidationStrategy({
            usage: "roulette",
            permission: this.funModule.playRoulette
        }));
         if (status !== ValidatorStatus.OK) return;

        await response.action("fun:roulette.lead_up", {username: sender.name});
        setTimeout(async () => {
            if (randomFloat() > 1/6) {
                await response.message("fun:roulette.safe", {username: sender.name});
            } else {
                await response.message("fun:roulette.hit", {username: sender.name});
                await this.funModule.adapter.tempbanChatter(sender, 60, await response.translate("fun:roulette.reason"));
            }
        }, 1000);
    }
}

class SeppukuCommand extends Command {
    constructor(private funModule: FunModule) {
        super("seppuku", null);
    }

    @CommandHandler("seppuku", "seppuku")
    @CheckPermission("fun.seppuku")
    async handleCommand(event: CommandEvent, @ResponseArg response: Response, @Sender sender: ChatterEntity): Promise<void> {
        const successful = await this.funModule.adapter.tempbanChatter(sender, 30, await response.translate("fun:seppuku.reason"));
        if (!successful) await response.message("error.bot-not-permitted");
    }
}

class Magic8BallCommand extends Command {
    constructor() {
        super("8ball", null);
    }

    @CommandHandler("8ball", "8ball")
    @CheckPermission("fun.8ball")
    async handleCommand(event: CommandEvent, @ResponseArg response: Response): Promise<void> {
        const resp = array_rand(await response.getTranslation<string[]>("fun:8ball.responses"));
        await response.message("fun:8ball.response", {response: resp});
    }
}

export default class FunModule extends AbstractModule {
    static [Symbols.ModuleInfo] = MODULE_INFO;

    constructor(@inject(Adapter) public adapter: Adapter) {
        super(FunModule);
    }

    @command rouletteCommand = new RouletteCommand(this);
    @command seppukuCommand = new SeppukuCommand(this);
    @command magic8BallCommand = new Magic8BallCommand();

    @permission playRoulette = new Permission("fun.roulette", Role.NORMAL);
    @permission playSeppuku = new Permission("fun.seppuku", Role.NORMAL);
    @permission play8Ball = new Permission("fun.8ball", Role.NORMAL);
}