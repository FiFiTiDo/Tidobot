import AbstractModule, {ModuleInfo, Systems} from "./AbstractModule";
import {array_rand} from "../Utilities/ArrayUtils";
import Permission from "../Systems/Permissions/Permission";
import {Role} from "../Systems/Permissions/Role";
import {inject} from "inversify";
import Command from "../Systems/Commands/Command";
import {CommandEventArgs} from "../Systems/Commands/CommandEvent";
import StandardValidationStrategy from "../Systems/Commands/Validator/Strategies/StandardValidationStrategy";
import {ValidatorStatus} from "../Systems/Commands/Validator/Strategies/ValidationStrategy";
import Adapter from "../Services/Adapter";
import getLogger from "../Utilities/Logger";

export const MODULE_INFO = {
    name: "Fun",
    version: "1.0.0",
    description: "Just a bunch of fun things that don't fit in their own module"
};

const logger = getLogger(MODULE_INFO.name);

class RouletteCommand extends Command {
    constructor(private adapter: Adapter) {
        super("roulette", null);
    }

    async execute({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {status} = await event.validate(new StandardValidationStrategy({
            usage: "roulette",
            permission: "fun.roulette"
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
                    await this.adapter.tempbanChatter(msg.getChatter(), 60, await response.translate("fun:roulette.reason"));
                } catch (e) {
                    logger.warn(msg.getChatter().name + " tried to play roulette but I couldn't tempban them", {cause: e});
                    return response.message("error.bot-not-permitted");
                }
            }
        }, 1000);
    }
}

class SeppukuCommand extends Command {
    constructor(private adapter: Adapter) {
        super("seppuku", null);
    }

    async execute({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {status} = await event.validate(new StandardValidationStrategy({
            usage: "seppuku",
            permission: "fun.seppuku"
        }));
         if (status !== ValidatorStatus.OK) return;

        try {
            return this.adapter.tempbanChatter(msg.getChatter(), 30, await response.translate("fun:seppuku.reason"));
        } catch (e) {
            logger.warn(msg.getChatter().name + " tried to commit seppuku but I couldn't tempban them", {cause: e});
            return response.message("error.bot-not-permitted");
        }
    }
}

class Magic8BallCommand extends Command {
    constructor() {
        super("8ball", null);
    }

    async execute({event, response}: CommandEventArgs): Promise<void> {
        const {status} = await event.validate(new StandardValidationStrategy({
            usage: "8ball",
            permission: "fun.8ball"
        }));
         if (status !== ValidatorStatus.OK) return;

        const resp = array_rand(await response.getTranslation("fun:8ball.responses"));
        await response.message("fun:8ball.response", {response: resp});
    }
}

export default class FunModule extends AbstractModule {
    constructor(@inject(Adapter) private adapter: Adapter) {
        super(FunModule.name);
    }

    initialize({ command, permission}: Systems): ModuleInfo {
        command.registerCommand(new RouletteCommand(this.adapter), this);
        command.registerCommand(new SeppukuCommand(this.adapter), this);
        command.registerCommand(new Magic8BallCommand(), this);
        permission.registerPermission(new Permission("fun.roulette", Role.NORMAL));
        permission.registerPermission(new Permission("fun.seppuku", Role.NORMAL));
        permission.registerPermission(new Permission("fun.8ball", Role.NORMAL));

        return MODULE_INFO;
    }
}