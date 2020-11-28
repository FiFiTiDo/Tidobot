import {InvalidArgumentError, TranslateMessageInputError} from "./ValidationErrors";
import {ArgumentConverter} from "./Argument";
import {CommandEvent} from "../CommandEvent";
import { ConvertingRepository, ConvertingRepositoryConstructor } from "../../../Database/Repositories/ConvertingRepository";
import { BaseEntity, getCustomRepository } from "typeorm";
import Event from "../../Event/Event";
import { isUndefined } from "lodash";

interface ErrorInfo {
    msgKey: string;
    optionKey: string;
}

export class EntityArg<T extends BaseEntity> implements ArgumentConverter<T> {
    type: string;
    private repository: ConvertingRepository<T>;

    constructor(repositoryCtor: ConvertingRepositoryConstructor<T>, private error?: ErrorInfo) {
        this.type = repositoryCtor.TYPE;
        this.repository = getCustomRepository(repositoryCtor);
    }

    async convert(input: string, name: string, column: number, event: Event): Promise<T> {
        const message = event.extra.get(CommandEvent.EXTRA_MESSAGE);
        const channel = message.channel;
        const entity = await this.repository.convert(input, channel);
        if (isUndefined(entity)) {
            if (this.error)
                throw new TranslateMessageInputError(this.error.msgKey, {[this.error.optionKey]: input});
            else
                throw new InvalidArgumentError(name, this.type, input, column);
        }
        return entity;
    }
}