import Chatter from "./Chatter";
import MessageParser from "./MessageParser";
import Channel from "./Channel";
import PermissionModule, {PermissionLevel} from "../Modules/PermissionModule";
import Application from "../Application/Application";
import Adapter from "../Services/Adapter";
import {ExpressionContext} from "../Modules/ExpressionModule";

export default class Message {
    private readonly raw: string;
    private readonly parts: string[];
    private readonly chatter: Chatter;
    private readonly channel: Channel;
    private readonly adapter: Adapter;
    private loopProtection: string[];

    constructor(raw: string, chatter: Chatter, channel: Channel, adapter: Adapter) {
        this.raw = raw;
        this.parts = MessageParser.parse(raw);
        this.chatter = chatter;
        this.channel = channel;
        this.adapter = adapter;
        this.loopProtection = [];
    }

    public async getUserLevels(): Promise<PermissionLevel[]> {
        let levels = [PermissionLevel.NORMAL];

        try {
            let rows = await this.channel.query("users").select().where().eq("id", this.chatter.getId()).done().all();

            if (rows.length > 0) {
                let user = rows[0];
                if (user.banned) levels.push(PermissionLevel.BANNED);
                if (user.regular) levels.push(PermissionLevel.REGULAR);
            }
        } catch (e) {
            Application.getLogger().error("Unable to get user's permission levels", {cause: e});
        }

        return levels;
    }

    public async getExpressionContext(): Promise<ExpressionContext> {
        return {
            sender: {
                id: this.getChatter().getId(),
                name: this.getChatter().getName(),
            },
            channel: {
                id: this.getChannel().getId(),
                name: this.getChannel().getName(),
                chatters: Application.getChatterManager().getAll(this.getChannel()).map(chatter => chatter.getName()),
                isLive: () => this.getChannel().online.get()
            },
            raw_arguments: this.parts.slice(1).join(" "),
            arguments: this.parts.slice(1),
            to_user: (() => {
                if (this.parts.length < 1) return "";

                let user = this.parts[0];
                return user.startsWith("@") ? user.substring(1) : user;
            })()
        }
    }

    public async checkPermission(permission: string) {
        return Application.getModuleManager().getModule(PermissionModule).checkPermission(permission, this.getChatter(), await this.getUserLevels());
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

    public getChatter() {
        return this.chatter;
    }

    public getChannel() {
        return this.channel;
    }

    public async reply(message: string) {
        return this.adapter.sendMessage(message, this.getChannel());
    }

    protected getAdapter() {
        return this.adapter;
    }

    public addToLoopProtection(command: string) {
        this.loopProtection.push(command.toLowerCase());
    }

    public checkLoopProtection(command: string): boolean {
        return this.loopProtection.indexOf(command.toLowerCase()) >= 0;
    }

    public extend(newRaw: string, onReply: (message: string) => void) {
        let msg = this;
        return new class extends Message {
            constructor() {
                super(newRaw, msg.getChatter(), msg.getChannel(), msg.adapter);

                this.loopProtection = msg.loopProtection.slice();
            }

            async getUserLevels(): Promise<PermissionLevel[]> {
                return msg.getUserLevels();
            }

            async getExpressionContext(): Promise<ExpressionContext> {
                return msg.getExpressionContext();
            }

            async reply(message: string): Promise<any> {
                onReply(message);
            }
        };
    }
}