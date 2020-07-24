import {EntityParameters} from "./Entity";
import moment, {Moment} from "moment";
import {Table} from "../Decorators/Table";
import {Column, DataTypes, Id} from "../Decorators/Columns";
import {where} from "../Where";
import Message from "../../Chat/Message";
import MessageParser from "../../Chat/MessageParser";
import ChannelEntity from "./ChannelEntity";
import ChannelSpecificEntity from "./ChannelSpecificEntity";
import CooldownSystem from "../../Systems/Cooldown/CooldownSystem";

export enum CommandConditionResponse {
    DONT_RUN, RUN_NOW, RUN_DEFAULT
}

@Id
@Table(({service, channel}) => `${service}_${channel.name}_commands`)
export default class CommandEntity extends ChannelSpecificEntity<CommandEntity> {
    public static readonly TYPE = "command";
    @Column()
    public trigger: string;
    @Column()
    public response: string;
    @Column()
    public condition: string;
    @Column({datatype: DataTypes.FLOAT})
    public price: number;
    @Column({name: "user_cooldown", datatype: DataTypes.INTEGER})
    public userCooldown: number;
    @Column({name: "global_cooldown", datatype: DataTypes.INTEGER})
    public globalCooldown: number;
    @Column()
    public enabled: boolean;
    @Column({name: "created_at", datatype: DataTypes.DATE})
    public createdAt: Moment;
    @Column({name: "updated_at", datatype: DataTypes.DATE})
    public updatedAt: Moment;

    constructor(id: number, params: EntityParameters) {
        super(CommandEntity, id, params);
    }

    public static async create(trigger: string, response: string, channel: ChannelEntity): Promise<CommandEntity | null> {
        const timestamp = moment().toISOString();
        return CommandEntity.make<CommandEntity>({channel}, {
            trigger, response, condition: "true", price: 0.0, cooldown: 0, created_at: timestamp, updated_at: timestamp
        });
    }

    public static async findByTrigger(trigger: string, channel: ChannelEntity): Promise<CommandEntity[]> {
        return CommandEntity.retrieveAll({channel}, where().eq("trigger", trigger));
    }

    public static async convert(raw: string, channel: ChannelEntity): Promise<CommandEntity | null> {
        const id = parseInt(raw);
        if (isNaN(id) || id < 0) return null;
        return this.get(id, {channel});
    }

    async checkCondition(msg: Message): Promise<CommandConditionResponse> {
        if (this.condition.toLowerCase() === "@@default") return CommandConditionResponse.RUN_DEFAULT;
        const doRun = await msg.evaluateExpression(this.condition);
        if (typeof doRun !== "boolean") return CommandConditionResponse.DONT_RUN;
        if (!CooldownSystem.getInstance().check(msg, this)) return CommandConditionResponse.DONT_RUN;
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
}