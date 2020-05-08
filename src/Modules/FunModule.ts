import AbstractModule from "./AbstractModule";
import {array_rand} from "../Utilities/ArrayUtils";
import {Key} from "../Utilities/Translator";
import Bot from "../Application/Bot";
import PermissionSystem from "../Systems/Permissions/PermissionSystem";
import Permission from "../Systems/Permissions/Permission";
import {Role} from "../Systems/Permissions/Role";
import {inject, injectable} from "inversify";
import Command from "../Systems/Commands/Command";
import {CommandEventArgs} from "../Systems/Commands/CommandEvent";
import CommandSystem from "../Systems/Commands/CommandSystem";

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

        await response.action(Key("fun.roulette.lead_up"), msg.getChatter().name);
        setTimeout(() => {
            if (Math.random() > 1 / 6) {
                response.message(Key("fun.roulette.safe"), msg.getChatter().name);
            } else {
                response.message(Key("fun.roulette.hit"), msg.getChatter().name);
                this.bot.tempbanChatter(msg.getChatter(), 60, response.translate(Key("fun.roulette.reason")));
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

        return this.bot.tempbanChatter(msg.getChatter(), 30, response.translate(Key("fun.seppuku.reason")));
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

        const resp = array_rand(response.getTranslator().get("fun.8ball.responses"));
        await response.message(Key("fun.8ball.response"), resp);
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