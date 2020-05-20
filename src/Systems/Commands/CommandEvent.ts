import Event from "../Event/Event";
import Message from "../../Chat/Message";
import {Response} from "../../Chat/Response";
import ChatterEntity from "../../Database/Entities/ChatterEntity";
import ChannelEntity from "../../Database/Entities/ChannelEntity";
import ValidationStrategy, {ValidatorResponse} from "./Validator/Strategies/ValidationStrategy";

export interface CommandEventArgs {
    event: CommandEvent;
    message: Message;
    response: Response;
    sender: ChatterEntity;
    channel: ChannelEntity;
}

export class CommandEvent extends Event<CommandEvent> {
    constructor(private readonly command: string, private readonly args: string[], private readonly msg: Message) {
        super(CommandEvent.name);
    }

    public getEventArgs(): CommandEventArgs {
        return {
            event: this,
            message: this.msg,
            response: this.msg.getResponse(),
            sender: this.msg.getChatter(),
            channel: this.msg.getChannel()
        };
    }

    getCommand(): string {
        return this.command;
    }

    getArgument(i: number): string {
        return this.args[i];
    }

    getArguments(): string[] {
        return this.args;
    }

    getArgumentCount(): number {
        return this.args.length;
    }

    shiftArgument(): string {
        return this.args.shift();
    }

    unshiftArgument(arg: string) {
        this.args.unshift(arg);
    }


    getMessage(): Message {
        return this.msg;
    }

    clone(): CommandEvent {
        return new CommandEvent(this.command, this.args.slice(), this.msg);
    }

    async validate<T>(strategy: ValidationStrategy<T>): Promise<ValidatorResponse<T>> {
        return strategy.validate(this);
    }
}