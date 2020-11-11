import "reflect-metadata";

import Application from "./Application/Application";
import ModuleManager from "./Modules/ModuleManager";
import FilterSystem from "./Systems/Filter/FilterSystem";
import Config from "./Systems/Config/Config";
import { AdapterToken, ServiceToken, TranslationProviderToken } from "./symbols";
import LastFMSystem from "./Systems/LastFM/LastFMSystem";
import {getLogger} from "./Utilities/Logger";
import CommandSystem from "./Systems/Commands/CommandSystem";
import Cache from "./Systems/Cache/Cache";
import EventSystem from "./Systems/Event/EventSystem";
import ExpressionSystem from "./Systems/Expressions/ExpressionSystem";
import PermissionSystem from "./Systems/Permissions/PermissionSystem";
import SettingsSystem from "./Systems/Settings/SettingsSystem";
import { ServiceManager } from "./Chat/ServiceManager";
import i18next from "i18next";
import Backend from "i18next-fs-backend";
import * as path from "path";
import { AdapterConstructor, AdapterManager } from "./Adapters/Adapter";
import TwitchAdapter from "./Adapters/Twitch/TwitchAdapter";
import { Container } from "typedi";

require("source-map-support").install({ hookRequire: true });

Container.set(TranslationProviderToken, async () => i18next.use(Backend).init({
    ns: [
        "bet", "command", "confirmation", "counter", "default", "expression", "filter", "fun", "groups", "lists",
        "news", "permission", "poll", "raffle", "setting", "user", "queue", "pokemon", "tidobot"
    ],
    defaultNS: "default",
    lng: process.env.LANGUAGE,
    fallbackLng: "en",
    backend: {
        loadPath: path.join(__dirname, "../resources/locales/{{lng}}/{{ns}}.json"),
        addPath: path.join(__dirname, "../resources/locales/{{lng}}/{{ns}}.missing.json")
    }
}));

async function initialize(): Promise<void> {
    const logger = getLogger("Bot");

    logger.info("Initializing adapters");

    const adapterManager = Container.get(AdapterManager);
    await adapterManager.registerAdapter(TwitchAdapter as unknown as AdapterConstructor<TwitchAdapter>);

    logger.info("Initializing service manager");

    const serviceManager = Container.get(ServiceManager);
    await serviceManager.initialize();

    logger.info("Registered service: " + serviceManager.service.name);
    Container.set(ServiceToken, serviceManager.service);
    Container.set(AdapterToken, Container.get(adapterManager.findAdapterByName(serviceManager.service.name)));

    logger.info("Initializing systems");

    Container.get(EventSystem);
    await Container.get(PermissionSystem).initialize();
    await Container.get(SettingsSystem).initialize();
    await Container.get(CommandSystem).initialize();
    await Container.get(ExpressionSystem).initialize();
    await Container.get(Cache).initialize();
    await Container.get(Config).initialize();
    await Container.get(FilterSystem).initialize();
    await Container.get(LastFMSystem).initialize();

    logger.info("Initializing application");

    const app = Container.get(Application);
    Container.get(ModuleManager);
    return app.start(process.argv);
}

initialize().then();
