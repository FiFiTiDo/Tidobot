import {Container} from "inversify";
import Adapter from "./Services/Adapter";
import Dictionary, {FileDictionaryParser} from "./Utilities/Structures/Dictionary";
import symbols from "./symbols";
import TwitchAdapter from "./Services/Twitch/TwitchAdapter";
import {default as winston} from "winston";
import ChannelManager from "./Chat/ChannelManager";
import * as Modules from "./Modules";
import Translator from "./Utilities/Translator";
import {TwitchMessage, TwitchMessageFactory} from "./Services/Twitch/TwitchMessage";
import Logger from "./Utilities/Logger";
import {Database} from "sqlite3";
import {Response, ResponseFactory} from "./Chat/Message";
import ModuleManager from "./Modules/ModuleManager";

require("winston-daily-rotate-file");

const container = new Container({ defaultScope: "Singleton" });

container.bind<winston.Logger>(symbols.Logger).toConstantValue(Logger.get());
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