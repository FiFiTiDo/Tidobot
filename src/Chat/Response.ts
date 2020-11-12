import Message from "./Message";
import {StringMap, TFunctionKeys, TFunctionResult, TOptions} from "i18next";
import {arrayRand} from "../Utilities/ArrayUtils";
import {TranslationProvider, TranslationProviderToken} from "../symbols";
import CommandSystem from "../Systems/Commands/CommandSystem";
import {Logger} from "log4js";
import {logError} from "../Utilities/Logger";
import Container from "typedi";
import Adapter from "../Adapters/Adapter";

export class Response {
    private translator: TranslationProvider;
    constructor(private readonly msg: Message, private readonly adapter: Adapter) {
        this.translator = Container.get(TranslationProviderToken);
    }

    rawMessage(message: string): Promise<void> {
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
        await this.adapter.broadcastMessage(await this.translate(key, options));
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
        const errors: string[] = await this.getTranslation<string[]>("generic-error");
        const error = arrayRand(errors);
        return this.rawMessage(error);
    }

    async genericErrorAndLog(e: Error, logger: Logger, message?: string, fatal = false): Promise<void> {
        logError(logger, e, message, fatal);
        return this.genericError();
    }

    async invalidArgument(argument: string, given: string, usage: string): Promise<void> {
        return CommandSystem.showInvalidArgument(argument, given, usage, this.msg);
    }

    async invalidArgumentKey(argumentKey: string, given: string, usage: string): Promise<void> {
        return this.invalidArgument(await this.translate(argumentKey), given, usage);
    }
}

export class ResponseFactory {
    constructor(private readonly adapter: Adapter) {}

    make(message: Message): Response {
        return new Response(message, this.adapter);
    }
}