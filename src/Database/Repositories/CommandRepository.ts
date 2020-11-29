import { Service } from "typedi";
import { EntityRepository } from "typeorm";
import { Channel } from "../Entities/Channel";
import { Command } from "../Entities/Command";
import { ConvertingRepository } from "./ConvertingRepository";

@Service()
@EntityRepository(Command)
export class CommandRepository extends ConvertingRepository<Command> {
    static TYPE = "command"

    async make(trigger: string, response: string, channel: Channel): Promise<Command> {
        const command = this.create({trigger, response, channel, commandId: channel.commandIdCounter++});
        await channel.save();
        return this.save(command);
    }

    convert(raw: string, channel: Channel): Promise<Command> {
        const intVal = parseInt(raw);
        if (isNaN(intVal)) return null;
        return this.findOne({ commandId: intVal, channel });
    }
}