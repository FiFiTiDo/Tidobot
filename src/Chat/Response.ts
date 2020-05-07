import Adapter from "../Services/Adapter";
import Translator, {TranslationKey} from "../Utilities/Translator";
import Message from "./Message";
import * as util from "util";
import ChannelManager from "./ChannelManager";

export default class Response {
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
        return this.translator.translate(key, args);
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