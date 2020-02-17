import AbstractModule from "./AbstractModule";
import PermissionModule, {PermissionLevel} from "./PermissionModule";
import CommandModule, {CommandEvent} from "./CommandModule";
import Application from "../Application/Application";
import {__, array_rand} from "../Utilities/functions";

export default class FunModule extends AbstractModule {
    constructor() {
        super(FunModule.name);
    }

    initialize() {
        const cmd = this.getModuleManager().getModule(CommandModule);
        cmd.registerCommand("roulette", this.roulette, this);
        cmd.registerCommand("seppuku", this.seppuku, this);
        cmd.registerCommand("8ball", this.magic8Ball, this);

        const perm = this.getModuleManager().getModule(PermissionModule);
        perm.registerPermission("fun.roulette", PermissionLevel.NORMAL);
        perm.registerPermission("fun.seppuku", PermissionLevel.NORMAL);
        perm.registerPermission("fun.8ball", PermissionLevel.NORMAL);
    }

    async roulette(event: CommandEvent) {
        let msg = event.getMessage();
        let args = await event.validate({
            usage: "roulette",
            permission: "fun.roulette"
        });
        if (args === null) return;

        Application.getAdapter().sendAction(__("fun.roulette.lead_up", msg.getChatter().getName()), msg.getChannel());
        setTimeout(() => {
            if (Math.random() > 1 / 6) {
                msg.reply(__("fun.roulette.safe", msg.getChatter().getName()));
            } else {
                msg.reply(__("fun.roulette.hit", msg.getChatter().getName()));
                Application.getAdapter().tempbanChatter(msg.getChatter(), 60, __("fun.roulette.reason"));
            }
        }, 1000);
    }

    async seppuku(event: CommandEvent) {
        let msg = event.getMessage();
        let args = await event.validate({
            usage: "seppuku",
            permission: "fun.seppuku"
        });
        if (args === null) return;

        Application.getAdapter().tempbanChatter(msg.getChatter(), 30, __("fun.seppuku.reason"));
    }

    async magic8Ball(event: CommandEvent) {
        let msg = event.getMessage();
        let args = await event.validate({
            usage: "8ball",
            permission: "fun.8ball"
        });
        if (args === null) return;

        let response = array_rand(Application.getTranslator().get("fun.8ball.responses"));
        await msg.reply(__("fun.8ball.response", response));
    }
}