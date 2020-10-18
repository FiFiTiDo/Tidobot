import Event from "../Event/Event";
import Message from "../../Chat/Message";
import {Response} from "../../Chat/Response";
import ChatterEntity from "../../Database/Entities/ChatterEntity";
import ChannelEntity from "../../Database/Entities/ChannelEntity";
import Command from "./Command";
import CommandEntity from "../../Database/Entities/CommandEntity";
import { Chatter } from "../../NewDatabase/Entities/Chatter";
import { Channel } from "../../NewDatabase/Entities/Channel";

export interface CommandEventArgs {
    event: CommandEvent;
    message: Message;
    response: Response;
    sender: Chatter;
    channel: Channel;
}

export class CommandEvent extends Event<CommandEvent> {
    static NAME = "chat_command";

    constructor(public readonly trigger: string, public readonly args: string[], public readonly message: Message, public readonly command: Command | CommandEntity) {
        super(CommandEvent);
    }

    public getEventArgs(): CommandEventArgs {
        return {
            event: this,
            message: this.message,
            response: this.message.response,
            sender: this.message.chatter,
            channel: this.message.channel
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
        return this.message;
    }

    clone(): CommandEvent {
        return new CommandEvent(this.trigger, this.args.slice(), this.message, this.command);
    }
}