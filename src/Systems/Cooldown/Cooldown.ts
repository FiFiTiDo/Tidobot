import Command from "../Commands/Command";
import { Command as CommandEntity } from "../../Database/Entities/Command";
import moment from "moment";

export default class Cooldown {
    private readonly executedAt: moment.Moment;

    constructor(
        private readonly command: Command | CommandEntity,
        private readonly subcommand: string | undefined,
        private readonly user: boolean
    ) {
        this.executedAt = moment();
    }

    /**
     * Checks the cooldown
     *
     * @returns True if the cooldown time has passed, False otherwise
     */
    check(): boolean {
        const copy = this.executedAt.clone();
        copy.add(this.getCooldown(), "seconds");
        return copy.isBefore(moment());
    }

    /**
     * Checks if this is the right cooldown
     *
     * @param command The command that was sent
     * @param subcommand The subcommand the was sent
     */
    is(command: Command | CommandEntity | Cooldown, subcommand?: string): boolean {
        if (command instanceof Cooldown) {
            return this.is(command.command, command.subcommand);
        }

        if (subcommand !== this.subcommand) return false;
        if (command instanceof Command && this.command instanceof Command) {
            return command.getLabel() === this.command.getLabel();
        } else if (command instanceof CommandEntity && this.command instanceof CommandEntity) {
            return command.is(this.command);
        }
        return false;
    }

    /**
     * Gets the cooldown length
     *
     * @returns Cooldown length in seconds
     */
    private getCooldown(): number {
        if (this.user) {
            return this.command instanceof Command ?
                this.command.getUserCooldown(this.subcommand) :
                this.command.userCooldown;
        } else {
            return this.command instanceof Command ?
                this.command.getGlobalCooldown(this.subcommand) :
                this.command.globalCooldown;
        }
    }
}