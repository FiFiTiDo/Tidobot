import AbstractModule, {ModuleInfo, Symbols, Systems} from "./AbstractModule";
import {array_rand} from "../Utilities/ArrayUtils";
import Permission from "../Systems/Permissions/Permission";
import {Role} from "../Systems/Permissions/Role";
import {inject} from "inversify";
import Command from "../Systems/Commands/Command";
import {CommandEventArgs} from "../Systems/Commands/CommandEvent";
import StandardValidationStrategy from "../Systems/Commands/Validator/Strategies/StandardValidationStrategy";
import {ValidatorStatus} from "../Systems/Commands/Validator/Strategies/ValidationStrategy";
import Adapter from "../Services/Adapter";
import {getLogger} from "../Utilities/Logger";
import {command} from "../Systems/Commands/decorators";
import {permission} from "../Systems/Permissions/decorators";

export const MODULE_INFO = {
    name: "Fun",
    version: "1.0.1",
    description: "Just a bunch of fun things that don't fit in their own module"
};

const logger = getLogger(MODULE_INFO.name);

class RouletteCommand extends Command {
    constructor(private funModule: FunModule) {
        super("roulette", null);
    }

    async execute({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {status} = await event.validate(new StandardValidationStrategy({
            usage: "roulette",
            permission: this.funModule.playRoulette
        }));
         if (status !== ValidatorStatus.OK) return;

        await response.action("fun:roulette.lead_up", {
            username: msg.getChatter().name
        });
        setTimeout(async () => {
            if (Math.random() > 1 / 6) {
                await response.message("fun:roulette.safe", {
                    username: msg.getChatter().name
                });
            } else {
                await response.message("fun:roulette.hit", {
                    username: msg.getChatter().name
                });
                try {
                    await this.funModule.adapter.tempbanChatter(msg.getChatter(), 60, await response.translate("fun:roulette.reason"));
                } catch (e) {
                    logger.warn(msg.getChatter().name + " tried to play roulette but I couldn't tempban them", {cause: e});
                    return response.message("error.bot-not-permitted");
                }
            }
        }, 1000);
    }
}

class SeppukuCommand extends Command {
    constructor(private funModule: FunModule) {
        super("seppuku", null);
    }

    async execute({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {status} = await event.validate(new StandardValidationStrategy({
            usage: "seppuku",
            permission: this.funModule.playSeppuku
        }));
         if (status !== ValidatorStatus.OK) return;

        try {
            return this.funModule.adapter.tempbanChatter(msg.getChatter(), 30, await response.translate("fun:seppuku.reason"));
        } catch (e) {
            logger.warn(msg.getChatter().name + " tried to commit seppuku but I couldn't tempban them", {cause: e});
            return response.message("error.bot-not-permitted");
        }
    }
}

class Magic8BallCommand extends Command {
    constructor(private funModule: FunModule) {
        super("8ball", null);
    }

    async execute({event, response}: CommandEventArgs): Promise<void> {
        const {status} = await event.validate(new StandardValidationStrategy({
            usage: "8ball",
            permission: this.funModule.play8Ball
        }));
         if (status !== ValidatorStatus.OK) return;

        const resp = array_rand(await response.getTranslation("fun:8ball.responses"));
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
    @command magic8BallCommand = new Magic8BallCommand(this);

    @permission playRoulette = new Permission("fun.roulette", Role.NORMAL);
    @permission playSeppuku = new Permission("fun.seppuku", Role.NORMAL);
    @permission play8Ball = new Permission("fun.8ball", Role.NORMAL);
}