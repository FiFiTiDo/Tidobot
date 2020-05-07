import {Container} from "inversify";
import Bot from "./Application/Bot";
import Adapter from "./Services/Adapter";
import Dictionary, {FileDictionaryParser} from "./Utilities/Structures/Dictionary";
import symbols, {DatabaseProvider} from "./symbols";
import TwitchAdapter from "./Services/Twitch/TwitchAdapter";
import {default as winston} from "winston";
import ChatterManager from "./Chat/ChatterList";
import ChannelManager from "./Chat/ChannelManager";
import ModuleManager from "./Modules/ModuleManager";
import * as Modules from "./Modules";
import Translator from "./Utilities/Translator";
import Application from "./Application/Application";
import Response, {ResponseFactory} from "./Chat/Response";
import {TwitchMessage, TwitchMessageFactory} from "./Services/Twitch/TwitchMessage";
import Logger from "./Utilities/Logger";
import * as sqlite3 from "sqlite3";
import * as path from "path";
import ChannelEntity from "./Database/Entities/ChannelEntity";
import UserEntity from "./Database/Entities/UserEntity";
import {Database} from "sqlite3";

require("winston-daily-rotate-file");

const container = new Container({ defaultScope: "Singleton" });

container.bind<winston.Logger>(symbols.Logger).toConstantValue(Logger.get());
container.bind<Application>(Application).toSelf();
container.bind<Bot>(Bot).toSelf();
container.bind<Dictionary>(symbols.Config).toConstantValue(FileDictionaryParser.parseSync("config", JSON.parse));
container.bind<TwitchAdapter>(TwitchAdapter).toSelf();
container.bind<Adapter>(Adapter).toDynamicValue(ctx => {
    const service = process.env.SERVICE;
    switch (service) {
        case "twitch":
            return ctx.container.get<TwitchAdapter>(TwitchAdapter);
        case "mixer":
            break; // TODO: Add mixer adapter
        default:
            throw new Error("Unknown service type: " + service);
    }
});
container.bind<DatabaseProvider>(symbols.DB).toProvider<Database>(() => {
    return async (): Promise<Database> => {
        const service = process.env.SERVICE;
        const db = new sqlite3.Database(path.join(process.cwd(), "data", "database.db"), sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE);

        try {
            await ChannelEntity.createTable({ service });
            await UserEntity.createTable({ service });
        } catch(e) {
            console.error("Unable to create databases for channels and users");
            console.error("Cause: " + e.message);
            console.error(e.stack);
        }

        return db;
    };
});
container.bind<ChatterManager>(ChatterManager).toSelf();
container.bind<ChannelManager>(ChannelManager).toSelf();
container.bind<ModuleManager>(ModuleManager).toSelf();
container.bind<Translator>(Translator).toSelf();
container.bind<Database>(Database).toSelf();
container.bind<ResponseFactory>(symbols.ResponseFactory).toFactory<Response>(ctx => (msg): Response => {
    const adapter = ctx.container.get<Adapter>(Adapter);
    const translator = ctx.container.get<Translator>(Translator);
    const channelManager = ctx.container.get<ChannelManager>(ChannelManager);
    return new Response(adapter, translator, channelManager, msg);
});
Modules.createBindings(container);
container.bind<TwitchMessageFactory>(symbols.TwitchMessageFactory).toFactory<TwitchMessage>(ctx => (raw, chatter, channel, userstate): TwitchMessage => {
    const adapter = ctx.container.get<Adapter>(Adapter) as TwitchAdapter;
    const responseFactory = ctx.container.get<ResponseFactory>(symbols.ResponseFactory);

    return new TwitchMessage(raw, chatter, channel, userstate, adapter, responseFactory);
});

export default container;