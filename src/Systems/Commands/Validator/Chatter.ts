import {onePartConverter, ValueConverterInfo} from "./Converter";
import ChatterEntity from "../../../Database/Entities/ChatterEntity";
import {InvalidInputError} from "./ValidationErrors";

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