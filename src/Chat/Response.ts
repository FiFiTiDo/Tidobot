import Adapter from "../Services/Adapter";
import ChannelManager from "./ChannelManager";
import Message from "./Message";
import {StringMap, TFunctionKeys, TFunctionResult, TOptions} from "i18next";
import {array_rand} from "../Utilities/ArrayUtils";
import {TranslationProvider} from "../symbols";

export class Response {
    constructor(private adapter: Adapter, private translator: TranslationProvider, private channelManager: ChannelManager, private msg: Message) {
    }

    rawMessage(message: string) {
        return this.adapter.sendMessage(message, this.msg.getChannel());
    }

    async message<TKeys extends TFunctionKeys = string,
        TInterpolationMap extends object = StringMap>(key: TKeys | TKeys[], options?: TOptions<TInterpolationMap>): Promise<void> {
        return this.rawMessage(await this.translate(key, options));
    }

    async action<TKeys extends TFunctionKeys = string,
        TInterpolationMap extends object = StringMap>(key: TKeys | TKeys[], options?: TOptions<TInterpolationMap>): Promise<void> {
        return this.adapter.sendAction(await this.translate(key, options), this.msg.getChannel());
    }

    async spam<TKeys extends TFunctionKeys = string,
        TInterpolationMap extends object = StringMap>(key: TKeys | TKeys[], options?: TOptions<TInterpolationMap>, {times, seconds} = {
        times: 1,
        seconds: 1
    }): Promise<void> {
        const send = async (): Promise<void> => {
            await this.rawMessage(await this.translate(key, options));
            if (--times > 0) setTimeout(send, seconds * 1000);
        };
        return send();
    }

    async broadcast<TKeys extends TFunctionKeys = string,
        TInterpolationMap extends object = StringMap>(key: TKeys | TKeys[], options?: TOptions<TInterpolationMap>): Promise<void> {
        const ops = [];
        for (const channel of this.channelManager.getAll())
            ops.push(this.adapter.sendMessage(await this.translate(key, options), channel));
        await Promise.all(ops);
    }

    async translate<TResult extends TFunctionResult = string,
        TKeys extends TFunctionKeys = string,
        TInterpolationMap extends object = StringMap>(key: TKeys | TKeys[], options?: TOptions<TInterpolationMap>): Promise<TResult> {
        return (await this.translator())(key, options);
    }

    async getTranslation<TResult extends TFunctionResult = string,
        TKeys extends TFunctionKeys = string,
        TInterpolationMap extends object = StringMap>(key: TKeys | TKeys[], options?: TOptions<TInterpolationMap>): Promise<TResult> {
        return (await this.translator())(key, Object.assign({}, options, {
            returnObjects: true
        }));
    }

    async genericError(): Promise<void> {
        const errors: string[] = await this.getTranslation("generic-error");
        const error = array_rand(errors);
        return this.rawMessage(error);
    }
}

export interface ResponseFactory {
    (msg: Message): Response;
}