import AbstractModule from "./AbstractModule";
import {array_rand} from "../Utilities/ArrayUtils";
import Bot from "../Application/Bot";
import PermissionSystem from "../Systems/Permissions/PermissionSystem";
import Permission from "../Systems/Permissions/Permission";
import {Role} from "../Systems/Permissions/Role";
import {inject} from "inversify";
import Command from "../Systems/Commands/Command";
import {CommandEventArgs} from "../Systems/Commands/CommandEvent";
import CommandSystem from "../Systems/Commands/CommandSystem";
import Logger from "../Utilities/Logger";

class RouletteCommand extends Command {
    constructor(private bot: Bot) {
        super("roulette", null);
    }

    async execute({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "roulette",
            permission: "fun.roulette"
        });
        if (args === null) return;

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
                    await this.bot.tempbanChatter(msg.getChatter(), 60, await response.translate("fun:roulette.reason"));
                } catch (e) {
                    Logger.get().warning(msg.getChatter().name + " tried to play roulette but I couldn't tempban them", {cause: e});
                    return response.message("error.bot-not-permitted");
                }
            }
        }, 1000);
    }
}

class SeppukuCommand extends Command {
    constructor(private bot: Bot) {
        super("seppuku", null);
    }

    async execute({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "seppuku",
            permission: "fun.seppuku"
        });
        if (args === null) return;

        try {
            return this.bot.tempbanChatter(msg.getChatter(), 30, await response.translate("fun:seppuku.reason"));
        } catch (e) {
            Logger.get().warning(msg.getChatter().name + " tried to commit seppuku but I couldn't tempban them", {cause: e});
            return response.message("error.bot-not-permitted");
        }
    }
}

class Magic8BallCommand extends Command {
    constructor() {
        super("8ball", null);
    }

    async execute({event, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "8ball",
            permission: "fun.8ball"
        });
        if (args === null) return;

        const resp = array_rand(await response.getTranslation("fun:8ball.responses"));
        await response.message("fun:8ball.response", {response: resp});
    }
}

export default class FunModule extends AbstractModule {
    constructor(@inject(Bot) private bot: Bot) {
        super(FunModule.name);
    }

    initialize(): void {
        const cmd = CommandSystem.getInstance();
        cmd.registerCommand(new RouletteCommand(this.bot), this);
        cmd.registerCommand(new SeppukuCommand(this.bot), this);
        cmd.registerCommand(new Magic8BallCommand(), this);

        const perm = PermissionSystem.getInstance();
        perm.registerPermission(new Permission("fun.roulette", Role.NORMAL));
        perm.registerPermission(new Permission("fun.seppuku", Role.NORMAL));
        perm.registerPermission(new Permission("fun.8ball", Role.NORMAL));
    }
}