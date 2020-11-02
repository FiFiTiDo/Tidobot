import Container from "typedi";
import { Column, CreateDateColumn, Entity, ManyToOne, UpdateDateColumn } from "typeorm";
import Message from "../../Chat/Message";
import MessageParser from "../../Chat/MessageParser";
import CooldownSystem from "../../Systems/Cooldown/CooldownSystem";
import { Channel } from "./Channel";
import CustomBaseEntity from "./CustomBaseEntity";

export enum CommandConditionResponse {
    DONT_RUN, RUN_NOW, RUN_DEFAULT
}

@Entity()
export class Command extends CustomBaseEntity {
    @Column()
    commandId: number;

    @Column()
    trigger: string;

    @Column()
    response: string;

    @Column()
    condition: string;

    @Column()
    price: number;

    @Column()
    userCooldown: number;

    @Column()
    globalCooldown: number;

    @Column()
    enabled: boolean;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @ManyToOne(() => Channel, channel => channel.commands)
    channel: Channel;

    async checkCondition(msg: Message): Promise<CommandConditionResponse> {
        if (this.condition.toLowerCase() === "@@default") return CommandConditionResponse.RUN_DEFAULT;
        const doRun = await msg.evaluateExpression(this.condition);
        if (typeof doRun !== "boolean") return CommandConditionResponse.DONT_RUN;
        if (!Container.get(CooldownSystem).check(msg, this)) return CommandConditionResponse.DONT_RUN;
        return doRun ? CommandConditionResponse.RUN_NOW : CommandConditionResponse.DONT_RUN;
    }

    async getResponse(msg: Message): Promise<string> {
        const parts = await Promise.all(MessageParser.parse(this.response).map(async part => {
            if (part.startsWith("${") && part.endsWith("}")) {
                return await msg.evaluateExpression(part.substr(2, part.length - 3));
            }

            return part;
        }));
        let resp = parts.join(" ");
        if (resp.startsWith("/") || resp.startsWith(".")) resp = ">> " + resp;
        return resp;
    }
}