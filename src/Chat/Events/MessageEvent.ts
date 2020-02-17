import Event from "../../Event/Event";
import Message from "../Message";

export default class MessageEvent extends Event<MessageEvent> {
    public static readonly NAME: string = "chat_message";

    private readonly message: Message;

    constructor(message: Message) {
        super(MessageEvent.NAME);

        this.message = message;
    }

    public getMessage(): Message {
        return this.message;
    }
}