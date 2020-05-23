import {TFunction} from "i18next";
import Adapter from "./Services/Adapter";

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
export type AdapterProvider = () => Promise<Adapter>;