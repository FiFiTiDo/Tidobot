import MessageParser from "./MessageParser";
import Adapter from "../Services/Adapter";
import ChatterEntity from "../Database/Entities/ChatterEntity";
import ChannelEntity from "../Database/Entities/ChannelEntity";
import {Role} from "../Systems/Permissions/Role";
import PermissionSystem from "../Systems/Permissions/PermissionSystem";
import ExpressionSystem, {ExpressionContext} from "../Systems/Expressions/ExpressionSystem";
import Translator, {TranslationKey} from "../Utilities/Translator";
import ChannelManager from "./ChannelManager";
import * as util from "util";

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

export class Response {
    constructor(private adapter: Adapter, private translator: Translator, private channelManager: ChannelManager, private msg: Message) {
    }

    private normalize(message: string|TranslationKey, args: any[]): string {
        return message instanceof TranslationKey ? this.translate(message, ...args) : util.format(message, ...args);
    }

    message(message: string|TranslationKey, ...args: any[]): Promise<void> {
        return this.adapter.sendMessage(this.normalize(message, args), this.msg.getChannel());
    }

    action(action: string|TranslationKey, ...args: any[]): Promise<void> {
        return this.adapter.sendAction(this.normalize(action, args), this.msg.getChannel());
    }

    spam(message: string|TranslationKey, times: number, seconds: number, ...args: any[]): Promise<void> {
        const send = async (): Promise<void> => {
            await this.adapter.sendMessage(this.normalize(message, args), this.msg.getChannel());
            if (--times > 0) setTimeout(send, seconds * 1000);
        };
        return send();
    }

    broadcast(message: string|TranslationKey, ...args: any[]): Promise<void[]> {
        const ops = [];
        for (const channel of this.channelManager.getAll())
            ops.push(this.adapter.sendMessage(this.normalize(message, args), channel));
        return Promise.all(ops);
    }

    translate(key: TranslationKey, ...args: any[]): string {
        return this.translator.translate(key, ...args);
    }

    getTranslation(key: TranslationKey): any {
        return this.translator.get(key);
    }

    public getTranslator(): Translator {
        return this.translator;
    }
}

export interface ResponseFactory {
    (msg: Message): Response;
}