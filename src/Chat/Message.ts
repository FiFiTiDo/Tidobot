import MessageParser from "./MessageParser";
import Adapter from "../Services/Adapter";
import ChatterEntity from "../Database/Entities/ChatterEntity";
import ChannelEntity from "../Database/Entities/ChannelEntity";
import Response, {ResponseFactory} from "./Response";
import {Role} from "../Systems/Permissions/Role";
import PermissionSystem from "../Systems/Permissions/PermissionSystem";
import ExpressionSystem, {ExpressionContext} from "../Systems/Expressions/ExpressionSystem";

export default class Message {

    private readonly parts: string[];
    private readonly response: Response;
    private loopProtection: string[];

    constructor(
        private readonly raw: string, private readonly chatter: ChatterEntity, private readonly channel: ChannelEntity,
        private readonly adapter: Adapter, private readonly responseFactory: ResponseFactory
    ) {
        this.parts = MessageParser.parse(raw);
        this.loopProtection = [];
        this.response = responseFactory(this);
    }

    public async getUserRoles(): Promise<Role[]> {
        const levels = [Role.NORMAL];

        if (this.chatter.banned) levels.push(Role.BANNED);
        if (this.chatter.regular) levels.push(Role.REGULAR);

        return levels;
    }

    public async getExpressionContext(): Promise<ExpressionContext> {
        return {
            sender: {
                id: this.getChatter().id,
                name: this.getChatter().name,
            },
            channel: {
                id: this.getChannel().id,
                name: this.getChannel().name,
                chatters: (await this.channel.chatters()).map(chatter => chatter.name),
                isLive: (): boolean => this.getChannel().online.get()
            },
            raw_arguments: this.parts.slice(1).join(" "),
            arguments: this.parts.slice(1),
            to_user: (append: unknown): string => {
                if (this.parts.length < 1) return "";

                let user = this.parts[0];
                if (typeof append === "string") user += append;

                return user.startsWith("@") ? user.substring(1) : user;
            }
        };
    }

    public async evaluateExpression(expression: string): Promise<string> {
        return ExpressionSystem.getInstance().evaluate(expression, this);
    }

    public async checkPermission(permission: string): Promise<boolean> {
        return PermissionSystem.getInstance().check(permission, this.chatter, await this.getUserRoles());
    }

    public getRaw(): string {
        return this.raw;
    }

    public getPart(i: number): string {
        return this.parts[i];
    }

    public getParts(): string[] {
        return this.parts;
    }

    public getChatter(): ChatterEntity {
        return this.chatter;
    }

    public getChannel(): ChannelEntity {
        return this.channel;
    }

    public getResponse(): Response {
        return this.response;
    }

    public async reply(message: string): Promise<void> {
        return this.adapter.sendMessage(message, this.getChannel());
    }

    public addToLoopProtection(command: string): void {
        this.loopProtection.push(command.toLowerCase());
    }

    public checkLoopProtection(command: string): boolean {
        return this.loopProtection.indexOf(command.toLowerCase()) >= 0;
    }

    public extend(newRaw: string, onReply: (message: string) => void): Message {
        const msg = this;
        return new class extends Message {
            constructor() {
                super(newRaw, msg.getChatter(), msg.getChannel(), msg.adapter, msg.responseFactory);

                this.loopProtection = msg.loopProtection.slice();
            }

            async getUserRoles(): Promise<Role[]> {
                return msg.getUserRoles();
            }

            async getExpressionContext(): Promise<ExpressionContext> {
                return msg.getExpressionContext();
            }

            async reply(message: string): Promise<void> {
                onReply(message);
            }
        };
    }
}