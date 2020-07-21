import {InvalidArgumentError, TranslateMessageInputError} from "./ValidationErrors";
import Entity, {EntityConstructor} from "../../../Database/Entities/Entity";
import ChannelEntity from "../../../Database/Entities/ChannelEntity";
import {ArgumentConverter} from "./Argument";
import {CommandEvent} from "../CommandEvent";

interface ConvertibleEntity<T extends Entity<T>> extends EntityConstructor<T> {
    convert(raw: string, channel: ChannelEntity): Promise<T|null>;
    TYPE: string;
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

        const entity = await this.entity.convert(input, channel);
        if (entity === null) {
            if (this.error)
                throw new TranslateMessageInputError(this.error.msgKey, {[this.error.optionKey]: input});
            else
                throw new InvalidArgumentError(name, this.entity.TYPE, input, column);
        }
        return entity;
    }
}