import Cooldown from "./Cooldown";
import Command from "../Commands/Command";
import { Command as CommandEntity } from "../../Database/Entities/Command";

export default class CooldownList {
    private readonly cooldowns: Cooldown[];

    constructor() {
        this.cooldowns = [];
    }

    public find(command: Command | CommandEntity, subcommand?: string): Cooldown {
        for (const cooldown of this.cooldowns)
            if (cooldown.is(command, subcommand))
                return cooldown;
        return null;
    }

    public replace(cooldown: Cooldown): void {
        const i = this.cooldowns.findIndex(other => other.is(cooldown));
        if (i > 0)

            for (let i = 0; i < this.cooldowns.length; i++) {
                const cooldown = this.cooldowns[i];
                if (cooldown.is(cooldown)) {
                    this.cooldowns.splice(i, 1);
                    this.cooldowns.push(cooldown);
                    break;
                }
            }
    }
}