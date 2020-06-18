import Cooldown from "./Cooldown";
import Command from "../Commands/Command";
import CommandEntity from "../../Database/Entities/CommandEntity";

export default class CooldownList {
    private readonly cooldowns: Cooldown[];

    constructor() {
        this.cooldowns = [];
    }

    public find(command: Command|CommandEntity, subcommand?: string) {
        for (const cooldown of this.cooldowns)
            if (cooldown.is(command, subcommand))
                return cooldown;
        return null;
    }

    public replace(newCooldown: Cooldown) {
        for (let i = 0; i < this.cooldowns.length; i++) {
            const cooldown = this.cooldowns[i];
            if (cooldown.is(newCooldown)) {
                this.cooldowns.splice(i, 1);
                this.cooldowns.push(newCooldown);
                break;
            }
        }
    }
}