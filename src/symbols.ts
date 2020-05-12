import {Database} from "sqlite3";
import {TFunction} from "i18next";

export default {
    TranslateFunc: Symbol("Translation function"),
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