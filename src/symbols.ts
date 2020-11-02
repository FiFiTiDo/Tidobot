import {TFunction} from "i18next";
import { Token } from "typedi";
import Adapter from "./Adapters/Adapter";
import { Service } from "./Database/Entities/Service";

export default {
    TranslateFunc: Symbol("Translation function"),
    Adapter: Symbol("Service Adapter"),
    Config: Symbol("config"),
    Logger: Symbol("logger"),
    DB: Symbol("database"),
    ServiceName: Symbol("Service Name"),
    ResponseFactory: Symbol("Response Factory"),
    CommandEventFactory: Symbol("Command Event Factory"),
    ConfirmationFactory: Symbol("Confirmation Factory"),
    TwitchMessageFactory: Symbol("Twitch Message Factory")
};

export type TranslationProvider = () => Promise<TFunction>;

export const ServiceToken = new Token<Service>("Service");
export const AdapterToken = new Token<Adapter>("Adapter");
export const TranslationProviderToken  = new Token<TranslationProvider>("Translation Function");