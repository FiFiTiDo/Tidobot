import ChatterEntity from "../../../Database/Entities/ChatterEntity";
import {TranslateMessageInputError} from "./ValidationErrors";
import {ArgumentConverter} from "./Argument";
import {CommandEvent} from "../CommandEvent";
import { Chatter } from "../../../NewDatabase/Entities/Chatter";

interface ChatterSettings {
    active?: boolean;
    senderDefault?: boolean;
}

export class ChatterArg implements ArgumentConverter<Chatter> {
    type = "chatter";

    constructor(private settings: ChatterSettings = {}) {
    }

    async convert(input: string, name: string, column: number, event: CommandEvent): Promise<Chatter> {
        const msg = event.message;
        const channel = msg.channel
        let chatterOptional = channel.findChatterByName(input);

        if (this.settings.active === true && !chatterOptional.present)
            throw new TranslateMessageInputError("user:inactive", {username: input});

        if (chatterOptional.present) return chatterOptional.value;
        else if (this.settings.senderDefault === true) return event.message.chatter
        else throw new TranslateMessageInputError("user:unknown", {username: input});
    }
}