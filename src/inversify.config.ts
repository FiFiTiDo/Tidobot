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
import {ALL_MODULES_KEY} from "./Modules";
import Translator from "./Utilities/Translator";
import Database from "./Database/Database";
import Application from "./Application/Application";
import Response, {ResponseFactory} from "./Chat/Response";
import {TwitchMessage, TwitchMessageFactory} from "./Services/Twitch/TwitchMessage";
import AbstractModule from "./Modules/AbstractModule";
import Logger from "./Utilities/Logger";

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
container.bind<DatabaseProvider>(symbols.DB).toProvider<Database>(ctx => {
    return (): Promise<Database> => {
        const adapter = ctx.container.get<Adapter>(Adapter);
        const modules = ctx.container.get<AbstractModule[]>(ALL_MODULES_KEY);
        return Database.create(adapter.getName(), modules);
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