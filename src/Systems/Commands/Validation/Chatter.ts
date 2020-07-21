import ChatterEntity from "../../../Database/Entities/ChatterEntity";
import {TranslateMessageInputError} from "./ValidationErrors";
import {ArgumentConverter} from "./Argument";
import {CommandEvent} from "../CommandEvent";

interface ChatterSettings {
    active?: boolean;
    senderDefault?: boolean;
}

export class ChatterArg implements ArgumentConverter<ChatterEntity> {
    constructor(private settings: ChatterSettings = {}) {}

    type = "chatter";
    async convert(input: string, name: string, column: number, event: CommandEvent): Promise<ChatterEntity> {
        const msg = event.getMessage();
        const channel = msg.getChannel();
        let chatter = channel.findChatterByName(input);

        if (this.settings.active === true && chatter === null)
            throw new TranslateMessageInputError("user:inactive", {username: input});

        if (chatter === null) chatter = await ChatterEntity.findByName(input.toLowerCase(), channel);
        if (chatter === null && this.settings.senderDefault === true) return event.getMessage().getChatter();
        if (chatter === null) throw new TranslateMessageInputError("user:unknown", {username: input});

        return chatter;
    }
}