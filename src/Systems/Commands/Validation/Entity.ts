import {InvalidArgumentError, TranslateMessageInputError} from "./ValidationErrors";
import {ArgumentConverter} from "./Argument";
import {CommandEvent} from "../CommandEvent";
import { ConvertingRepository, ConvertingRepositoryConstructor } from "../../../Database/Repositories/ConvertingRepository";
import { BaseEntity } from "typeorm";
import Container from "typedi";

interface ErrorInfo {
    msgKey: string;
    optionKey: string;
}

export class EntityArg<T extends BaseEntity> implements ArgumentConverter<T> {
    type: string;
    private repository: ConvertingRepository<T>;

    constructor(repositoryCtor: ConvertingRepositoryConstructor<T>, private error?: ErrorInfo) {
        this.type = repositoryCtor.TYPE;
        this.repository = Container.get(repositoryCtor);
    }

    async convert(input: string, name: string, column: number, event: CommandEvent): Promise<T> {
        const msg = event.getMessage();
        const channel = msg.getChannel();

        const entity = await this.repository.convert(input, channel);
        if (entity === null) {
            if (this.error)
                throw new TranslateMessageInputError(this.error.msgKey, {[this.error.optionKey]: input});
            else
                throw new InvalidArgumentError(name, this.type, input, column);
        }
        return entity;
    }
}