import {Container} from "inversify";
import Adapter from "./Services/Adapter";
import Dictionary, {FileDictionaryParser} from "./Utilities/Structures/Dictionary";
import symbols, {TranslationProvider} from "./symbols";
import TwitchAdapter from "./Services/Twitch/TwitchAdapter";
import {default as winston} from "winston";
import ChannelManager from "./Chat/ChannelManager";
import * as Modules from "./Modules";
import {TwitchMessage, TwitchMessageFactory} from "./Services/Twitch/TwitchMessage";
import Logger from "./Utilities/Logger";
import {Database} from "sqlite3";
import ModuleManager from "./Modules/ModuleManager";
import {Response, ResponseFactory} from "./Chat/Response";
import i18next, {TFunction} from "i18next";
import Backend from "i18next-fs-backend";
import {join} from "path";
import Config from "./Systems/Config/Config";
import GeneralConfig from "./Systems/Config/ConfigModels/GeneralConfig";

require("winston-daily-rotate-file");

const container = new Container({defaultScope: "Singleton"});

container.bind<winston.Logger>(symbols.Logger).toConstantValue(Logger.get());
container.bind<TwitchAdapter>(TwitchAdapter).toSelf();
container.bind<Adapter>(Adapter).toProvider(ctx => async () => {
    const config = await Config.getInstance().getConfig(GeneralConfig);
    const service = config.service;
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
container.bind<TranslationProvider>(symbols.TranslateFunc).toProvider<TFunction>(() => {
    return async () => {
        return await i18next.use(Backend).init({
            ns: [
                "bet", "command", "confirmation", "counter", "default", "expression", "filter", "fun", "groups", "lists",
                "news", "permission", "poll", "raffle", "setting", "user", "queue", "pokemon"
            ],
            defaultNS: "default",
            lng: process.env.LANGUAGE,
            fallbackLng: "en",
            backend: {
                loadPath: join(__dirname, "../resources/locales/{{lng}}/{{ns}}.json"),
                addPath: join(__dirname, "../resources/locales/{{lng}}/{{ns}}.missing.json")
            }
        });
    }
});
container.bind<Database>(Database).toSelf();
container.bind<ResponseFactory>(symbols.ResponseFactory).toFactory<Response>(ctx => (msg): Response => {
    const adapter = ctx.container.get<Adapter>(Adapter);
    const translator = ctx.container.get<TranslationProvider>(symbols.TranslateFunc);
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