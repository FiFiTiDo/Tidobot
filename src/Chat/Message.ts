import MessageParser from "./MessageParser";
import Adapter from "../Adapters/Adapter";
import {getMaxRole, Role} from "../Systems/Permissions/Role";
import PermissionSystem from "../Systems/Permissions/PermissionSystem";
import ExpressionSystem, {ExpressionContext} from "../Systems/Expressions/ExpressionSystem";
import {Response} from "./Response";
import {returnError, validateFunction} from "../Utilities/ValidateFunction";
import { Chatter } from "../Database/Entities/Chatter";
import { Channel } from "../Database/Entities/Channel";
import Container from "typedi";
import ChannelManager from "./ChannelManager";
import { PermissionLike } from "../Utilities/Interfaces/PermissionLike";
import { ChatterManager } from "./ChatterManager";

export default class Message {
    public stripped: string;
    public readonly parts: string[];
    public readonly response: Response;
    private loopProtection: string[];

    constructor(
        public readonly raw: string, public readonly chatter: Chatter, public readonly channel: Channel, public readonly adapter: Adapter
    ) {
        this.parts = MessageParser.parse(raw);
        this.loopProtection = [];
        this.response = new Response(this, adapter);
        this.stripped = raw;
    }

    public async getUserRoles(): Promise<Role[]> {
        const levels = [Role.NORMAL];

        if (this.chatter.banned) levels.push(Role.BANNED);
        if (this.chatter.regular) levels.push(Role.REGULAR);

        return levels;
    }

    public async getExpressionContext(): Promise<ExpressionContext> {
        const chatterManager = Container.get(ChatterManager);

        return {
            sender: {
                id: this.chatter.id,
                name: this.chatter.user.name,
            },
            channel: {
                id: this.getChannel().id,
                name: this.getChannel().name,
                chatters: this.channel.chatters.map(chatter => chatter.user.name),
                activeChatters: this.channel.chatters.filter(chatter => chatterManager.isActive(chatter)).map(chatter => chatter.user.name),
                isLive: (): boolean => Container.get(ChannelManager).isOnline(this.channel)
            },
            raw_arguments: this.parts.slice(1).join(" "),
            arguments: this.parts.slice(1),
            to_user: validateFunction((defaultSender = true, prepend?: string, append?: string): string => {
                const doDefault = this.parts.length < 2;
                if (doDefault && !defaultSender) return "";
                let resp = "";
                if (prepend) resp += prepend;
                const name = doDefault ? this.chatter.user.name : this.parts[1];
                resp += name.startsWith("@") ? name.substring(1) : name;
                if (append) resp += append;
                return resp;
            }, ["boolean", "string", "string"], returnError()),
        };
    }

    public async evaluateExpression(expression: string): Promise<string> {
        return Container.get(ExpressionSystem).evaluate(expression, this);
    }

    public async checkPermission(permission: string | PermissionLike): Promise<boolean> {
        return Container.get(PermissionSystem).check(permission, this.chatter, this.channel, await this.getUserRoles());
    }

    public async checkRole(role: Role): Promise<boolean> {
        return getMaxRole(await this.getUserRoles()) >= role;
    }

    public getRaw(): string {
        return this.raw;
    }

    public getStripped(): string {
        return this.stripped;
    }

    public getPart(i: number): string {
        return this.parts[i];
    }

    public getParts(): string[] {
        return this.parts;
    }

    public getChatter(): Chatter {
        return this.chatter;
    }

    public getChannel(): Channel {
        return this.channel;
    }

    public getResponse(): Response {
        return this.response;
    }

    public getAdapter(): Adapter {
        return this.adapter;
    }

    public addToLoopProtection(command: string): void {
        this.loopProtection.push(command.toLowerCase());
    }

    public checkLoopProtection(command: string): boolean {
        return this.loopProtection.indexOf(command.toLowerCase()) >= 0;
    }

    public extend(newRaw: string, onReply: (message: string) => void): Message {
        const { getUserRoles, getExpressionContext, chatter, channel, adapter, loopProtection } = this;
        return new class extends Message {
            constructor() {
                super(newRaw, chatter, channel, adapter);

                this.loopProtection = loopProtection.slice();
            }

            async getUserRoles(): Promise<Role[]> {
                return getUserRoles();
            }

            async getExpressionContext(): Promise<ExpressionContext> {
                return getExpressionContext();
            }

            async reply(message: string): Promise<void> {
                onReply(message);
            }
        };
    }
}

