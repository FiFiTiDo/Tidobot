import Entity from "./Entity";
import {DataTypes} from "../Schema";
import moment, {Moment} from "moment";
import {Table} from "../Decorators/Table";
import {Column} from "../Decorators/Columns";
import {where} from "../BooleanOperations";
import Message from "../../Chat/Message";
import Application from "../../Application/Application";
import ExpressionModule from "../../Modules/ExpressionModule";
import MessageParser from "../../Chat/MessageParser";

export enum CommandConditionResponse {
    DONT_RUN, RUN_NOW, RUN_DEFAULT
}

@Table((service, channel) => `${service}_${channel}_commands`)
export default class CommandEntity extends Entity {
    constructor(id: number, service?: string, channel?: string) {
        super(CommandEntity, id, service, channel);
    }

    @Column({ datatype: DataTypes.STRING })
    public trigger: string;

    @Column({ datatype: DataTypes.STRING })
    public response: string;

    @Column({ datatype: DataTypes.STRING })
    public condition: string;

    @Column({ datatype: DataTypes.FLOAT })
    public price: number;

    @Column({ datatype: DataTypes.INTEGER })
    public cooldown: number;

    @Column({ datatype: DataTypes.DATE })
    public created_at: Moment;

    @Column({ datatype: DataTypes.DATE })
    public updated_at: Moment;

    async checkCondition(msg: Message, def = false): Promise<CommandConditionResponse> {
        if (this.condition.toLowerCase() === "@@default" && !def) return CommandConditionResponse.RUN_DEFAULT;
        return Application.getModuleManager().getModule(ExpressionModule).evaluate(this.condition, msg) ?
            CommandConditionResponse.RUN_NOW : CommandConditionResponse.DONT_RUN;
    }

    async getResponse(msg: Message) {
        let raw_parts = MessageParser.parse(this.response);
        let parts = [];
        for (let part of raw_parts) {
            if (part.startsWith("${") && part.endsWith("}")) {
                parts.push(await Application.getModuleManager().getModule(ExpressionModule).evaluate(part.substr(2, part.length - 3), msg));
                continue;
            }

            parts.push(part);
        }
        let resp = parts.join(" ");
        if (resp.startsWith("/") || resp.startsWith(".")) resp = ">> " + resp;
        return resp;
    }

    public static async create(trigger: string, response: string, service: string, channel: string) {
        let created_at, updated_at;
        created_at = updated_at = moment().toISOString();
        return CommandEntity.make<CommandEntity>(service, channel, {
            trigger, response, condition: "true", price: 0.0, cooldown: 0, created_at, updated_at
        });
    }

    public static async findByTrigger(trigger: string, service: string, channel: string) {
        return Entity.retrieveAll(CommandEntity, service, channel, where().eq("trigger", trigger));
    }
}