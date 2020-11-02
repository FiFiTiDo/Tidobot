import Event, {EventArguments} from "../../Systems/Event/Event";
import Message from "../Message";
import {Response} from "../Response";
import { Channel } from "../../Database/Entities/Channel";
import { Chatter } from "../../Database/Entities/Chatter";

export default class MessageEvent extends Event<MessageEvent> {
    public static readonly NAME: string = "chat_message";

    private readonly message: Message;

    constructor(message: Message) {
        super(MessageEvent);

        this.message = message;
    }

    public getMessage(): Message {
        return this.message;
    }

    getEventArgs(): MessageEventArgs {
        return Object.assign(super.getEventArgs(), {
            message: this.message,
            response: this.message.getResponse(),
            sender: this.message.getChatter(),
            channel: this.message.getChannel()
        });
    }
}

export interface MessageEventArgs extends EventArguments<MessageEvent> {
    message: Message;
    response: Response;
    sender: Chatter;
    channel: Channel;
}