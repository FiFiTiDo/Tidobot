import Command from "../Commands/Command";
import CommandEntity from "../../Database/Entities/CommandEntity";
import moment from "moment";

export default class Cooldown {
    private readonly executedAt: moment.Moment;

    constructor(
        private readonly command: Command|CommandEntity,
        private readonly subcommand: string|undefined
    ) {
        this.executedAt = moment();
    }

    /**
     * Gets the cooldown length
     *
     * @returns Cooldown length in seconds
     */
    private getCooldown(): number {
        return this.command instanceof Command ? this.command.getCooldown(this.subcommand) : this.command.userCooldown;
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
    is(command: Command|CommandEntity|Cooldown, subcommand?: string): boolean {
        if (command instanceof Cooldown) {
            return this.is(command.command, command.subcommand);
        }

        if (subcommand !== this.subcommand) return false;
        if (command instanceof Command && this.command instanceof Command) {
            return command.getLabel() === this.command.getLabel();
        } else if (command instanceof CommandEntity && this.command instanceof CommandEntity) {
            return command.is(this.command)
        }
        return false;
    }
}