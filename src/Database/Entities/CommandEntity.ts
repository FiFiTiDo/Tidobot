import {EntityParameters} from "./Entity";
import moment, {Moment} from "moment";
import {Table} from "../Decorators/Table";
import {Column, DataTypes, Id} from "../Decorators/Columns";
import {where} from "../Where";
import Message from "../../Chat/Message";
import MessageParser from "../../Chat/MessageParser";
import ChannelEntity from "./ChannelEntity";
import ChannelSpecificEntity from "./ChannelSpecificEntity";

export enum CommandConditionResponse {
    DONT_RUN, RUN_NOW, RUN_DEFAULT
}

@Id
@Table(({service, channel}) => `${service}_${channel.name}_commands`)
export default class CommandEntity extends ChannelSpecificEntity<CommandEntity> {
    constructor(id: number, params: EntityParameters) {
        super(CommandEntity, id, params);
    }

    @Column()
    public trigger: string;

    @Column()
    public response: string;

    @Column()
    public condition: string;

    @Column({ datatype: DataTypes.FLOAT })
    public price: number;

    @Column({ datatype: DataTypes.INTEGER })
    public cooldown: number;

    @Column({ name: "created_at", datatype: DataTypes.DATE })
    public createdAt: Moment;

    @Column({ name: "updated_at", datatype: DataTypes.DATE })
    public updatedAt: Moment;

    async checkCondition(msg: Message): Promise<CommandConditionResponse> {
        if (this.condition.toLowerCase() === "@@default") return CommandConditionResponse.RUN_DEFAULT;
        const doRun = await msg.evaluateExpression(this.condition);
        if (typeof doRun !== "boolean") return CommandConditionResponse.DONT_RUN;
        return doRun ? CommandConditionResponse.RUN_NOW : CommandConditionResponse.DONT_RUN;
    }

    async getResponse(msg: Message): Promise<string> {
        const rawParts = MessageParser.parse(this.response);
        const parts = [];
        for (const part of rawParts) {
            if (part.startsWith("${") && part.endsWith("}")) {
                parts.push(await msg.evaluateExpression(part.substr(2, part.length - 3)));
                continue;
            }

            parts.push(part);
        }
        let resp = parts.join(" ");
        if (resp.startsWith("/") || resp.startsWith(".")) resp = ">> " + resp;
        return resp;
    }

    public static async create(trigger: string, response: string, channel: ChannelEntity): Promise<CommandEntity|null> {
        const timestamp = moment().toISOString();
        return CommandEntity.make<CommandEntity>({ channel }, {
            trigger, response, condition: "true", price: 0.0, cooldown: 0, created_at: timestamp, updated_at: timestamp
        });
    }

    public static async findByTrigger(trigger: string, channel: ChannelEntity): Promise<CommandEntity[]> {
        return CommandEntity.retrieveAll({ channel }, where().eq("trigger", trigger));
    }
}