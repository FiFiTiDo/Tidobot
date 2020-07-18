import {onePartConverter, ValueConverterInfo} from "./Converter";
import {InvalidArgumentError, InvalidInputError} from "./ValidationErrors";
import Entity, {EntityConstructor} from "../../../Database/Entities/Entity";
import ChannelEntity from "../../../Database/Entities/ChannelEntity";
import {ArgumentConverter} from "./Argument";
import {CommandEvent} from "../CommandEvent";

interface ConvertibleEntity<T extends Entity<T>> extends EntityConstructor<T> {
    convert(raw: string, channel: ChannelEntity): Promise<T|null>;
    TYPE: string;
}

interface EntityOptions<T extends Entity<T>> {
    name: string;
    entity: ConvertibleEntity<T>;
    required: boolean;
    error?: {
        msgKey: string,
        optionKey: string
    }
}

export function entity<T extends Entity<T>>(opts: EntityOptions<T>): ValueConverterInfo<T> {
    return onePartConverter(opts.name, opts.entity.TYPE, opts.required, null, async (part, column, msg) => {
        const entity = await opts.entity.convert(part, msg.getChannel());
        if (entity === null) {
            if (opts.error)
                throw new InvalidInputError(await msg.getResponse().translate(opts.error.msgKey, {[opts.error.optionKey]: part}));
            else
                throw new InvalidArgumentError(opts.name, opts.entity.TYPE, part, column);
        }
        return entity;
    });
}

interface ErrorInfo {
    msgKey: string;
    optionKey: string;
}

export class EntityArg<T extends Entity<T>> implements ArgumentConverter<T> {
    type: string;

    constructor(private entity: ConvertibleEntity<T>, private error?: ErrorInfo) {
        this.type = entity.TYPE;
    }

    async convert(input: string, name: string, column: number, event: CommandEvent): Promise<T> {
        const msg = event.getMessage();
        const channel = msg.getChannel();
        const response = msg.getResponse();

        const entity = await this.entity.convert(input, channel);
        if (entity === null) {
            if (this.error)
                throw new InvalidInputError(await response.translate(this.error.msgKey, {[this.error.optionKey]: input}));
            else
                throw new InvalidArgumentError(name, this.entity.TYPE, input, column);
        }
        return entity;
    }
}