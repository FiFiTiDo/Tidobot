import {onePartConverter, ValueConverterInfo} from "./Converter";
import ChatterEntity from "../../../Database/Entities/ChatterEntity";
import {InvalidInputError} from "./ValidationErrors";
import {ArgumentConverter} from "./Argument";
import {CommandEvent} from "../CommandEvent";

interface ChatterOptions {
    name: string;
    required: boolean;
    active?: boolean;
}

export function chatter(opts: ChatterOptions): ValueConverterInfo<ChatterEntity|null> {
    return onePartConverter(opts.name, "chatter", opts.required, null, async (part, column, msg) => {
        let chatter = msg.getChannel().findChatterByName(part);

        if (opts.active === true && chatter === null)
            throw new InvalidInputError(await msg.getResponse().translate("user:inactive", {username: part}));

        if (chatter === null) chatter = await ChatterEntity.findByName(part.toLowerCase(), msg.getChannel());
        if (chatter === null)
            throw new InvalidInputError(await msg.getResponse().translate("user:unknown", {username: part}));

        return chatter;
    });
}

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
        const response = msg.getResponse();
        let chatter = channel.findChatterByName(input);

        if (this.settings.active === true && chatter === null)
            throw new InvalidInputError(await response.translate("user:inactive", {username: input}));

        if (chatter === null) chatter = await ChatterEntity.findByName(input.toLowerCase(), channel);
        if (chatter === null && this.settings.senderDefault === true) return event.getMessage().getChatter();
        if (chatter === null)
            throw new InvalidInputError(await response.translate("user:unknown", {username: input}));

        return chatter;
    }
}