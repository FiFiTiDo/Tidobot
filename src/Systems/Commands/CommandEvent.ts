import Message from "../../Chat/Message";
import {Response} from "../../Chat/Response";
import Command from "./Command";
import { Command as CommandEntity } from "../../Database/Entities/Command";
import { Chatter } from "../../Database/Entities/Chatter";
import { Channel } from "../../Database/Entities/Channel";
import { ExtraKey } from "../Event/EventExtra";

export interface CommandEventArgs {
    event: CommandEvent;
    message: Message;
    response: Response;
    sender: Chatter;
    channel: Channel;
}

export class CommandEvent {
    public static readonly EVENT_TYPE = "systems.commands.CommandEvent";
    public static readonly EXTRA_TRIGGER = new ExtraKey<string>("systems.command.CommandEvent:extra.trigger");
    public static readonly EXTRA_ARGUMENTS = new ExtraKey<string[]>("systems.command.CommandEvent:extra.arguments");
    public static readonly EXTRA_MESSAGE = new ExtraKey<Message>("systems.command.CommandEvent:extra.message");
    public static readonly EXTRA_COMMAND = new ExtraKey<Command|CommandEntity>("systems.command.CommandEvent:extra.command");
}