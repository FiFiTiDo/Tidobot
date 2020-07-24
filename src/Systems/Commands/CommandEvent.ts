import Event from "../Event/Event";
import Message from "../../Chat/Message";
import {Response} from "../../Chat/Response";
import ChatterEntity from "../../Database/Entities/ChatterEntity";
import ChannelEntity from "../../Database/Entities/ChannelEntity";
import Command from "./Command";
import CommandEntity from "../../Database/Entities/CommandEntity";

export interface CommandEventArgs {
    event: CommandEvent;
    message: Message;
    response: Response;
    sender: ChatterEntity;
    channel: ChannelEntity;
}

export class CommandEvent extends Event<CommandEvent> {
    static NAME = "chat_command";

    constructor(private readonly trigger: string, private readonly args: string[], private readonly msg: Message, private readonly command: Command | CommandEntity) {
        super(CommandEvent);
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


    getMessage(): Message {
        return this.msg;
    }

    clone(): CommandEvent {
        return new CommandEvent(this.trigger, this.args.slice(), this.msg, this.command);
    }
}