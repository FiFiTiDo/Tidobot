import {TranslateMessageInputError} from "./ValidationErrors";
import {ArgumentConverter} from "./Argument";
import {CommandEvent} from "../CommandEvent";
import { Chatter } from "../../../Database/Entities/Chatter";
import Event from "../../Event/Event";

interface ChatterSettings {
    active?: boolean;
    senderDefault?: boolean;
}

export class ChatterArg implements ArgumentConverter<Chatter> {
    type = "chatter";

    constructor(private settings: ChatterSettings = {}) {
    }

    async convert(input: string, name: string, column: number, event: Event): Promise<Chatter> {
        const message = event.extra.get(CommandEvent.EXTRA_MESSAGE);
        const channel = message.channel;
        const chatter = channel.findChatterByName(input);

        if (this.settings.active === true && !chatter.present)
            throw new TranslateMessageInputError("user:inactive", {username: input});

        if (chatter.present) return chatter.value;
        else if (this.settings.senderDefault === true) return message.chatter;
        else throw new TranslateMessageInputError("user:unknown", {username: input});
    }
}