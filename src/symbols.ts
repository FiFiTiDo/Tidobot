import Database from "./Database/Database";

export default {
    Config: Symbol("config"),
    Logger: Symbol("logger"),
    DB: Symbol("database"),
    ServiceName: Symbol("Service Name"),
    ResponseFactory: Symbol("Response Factory"),
    CommandEventFactory: Symbol("Command Event Factory"),
    ConfirmationFactory: Symbol("Confirmation Factory"),
    MessageFactory: Symbol("Message Factory"),
    TwitchMessageFactory: Symbol("Twitch Message Factory"),
};

export type DatabaseProvider = () => Promise<Database>;