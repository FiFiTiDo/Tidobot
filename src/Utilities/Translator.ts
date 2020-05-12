import Dictionary, {FileDictionaryParser} from "./Structures/Dictionary";
import YAML from "yaml"
import * as util from "util"
import {injectable} from "inversify";
import i18next, {StringMap, TFunction, TFunctionKeys, TFunctionResult, TOptions} from "i18next";
import Backend from "i18next-fs-backend";


export class TranslationKey<TKeys extends TFunctionKeys = string> {
    constructor(public key: TKeys) {
    }
}

export function Key<TKeys extends TFunctionKeys = string>(key: TKeys): TranslationKey<TKeys> {
    return new TranslationKey(key);
}

@injectable()
export default class Translator {
    private translateFunc: TFunction = null;

    public async initialize() {
        this.translateFunc = await i18next.use(Backend).init({
            ns: [
                "bet", "command", "confirmation", "counter", "default", "expression", "filter", "fun", "groups", "lists",
                "news", "permission", "poll", "raffle", "setting", "user"
            ],
            defaultNS: "default"
        });
    }

    get<
        TResult extends TFunctionResult = string,
        TKeys extends TFunctionKeys = string,
        TInterpolationMap extends object = StringMap
    >(key: TKeys|TKeys[], options: TOptions<TInterpolationMap>): TResult {
        if (this.translateFunc === null)
            throw new Error("Translator not initialized.");

        return this.translateFunc(key, Object.assign({}, options, {
            returnObjects: true
        }));
    }

    translate<
        TResult extends TFunctionResult = string,
        TKeys extends TFunctionKeys = string,
        TInterpolationMap extends object = StringMap
    >(key: TKeys|TKeys[], options: TOptions<TInterpolationMap>): TResult {
        if (this.translateFunc === null)
            throw new Error("Translator not initialized.");

        return this.translateFunc(key, options);
    }
}