import "reflect-metadata";
import Application from "./Application/Application";
import container from "./inversify.config";
import {buildProviderModule} from "inversify-binding-decorators";
import ModuleManager from "./Modules/ModuleManager";
import FilterSystem from "./Systems/Filter/FilterSystem";
import GeneralConfig from "./Systems/Config/ConfigModels/GeneralConfig";
import Config from "./Systems/Config/Config";
import symbols from "./symbols";
import LastFMSystem from "./Systems/LastFM/LastFMSystem";
import {configure, getLogger} from "log4js";
import CommandSystem from "./Systems/Commands/CommandSystem";
import Cache from "./Systems/Cache/Cache";
import EventSystem from "./Systems/Event/EventSystem";
import ExpressionSystem from "./Systems/Expressions/ExpressionSystem";
import PermissionSystem from "./Systems/Permissions/PermissionSystem";
import SettingsSystem from "./Systems/Settings/SettingsSystem";

require("source-map-support").install({
    hookRequire: true
});

configure({
    appenders: {
        everything: {type: "file", filename: "logs/application.log", maxLogSize: 10485760, backups: 3, compress: true},
        console: {type: "console"},
        consoleNoDebug: {type: "logLevelFilter", appender: "console", level: "info"}
    },
    categories: {
        default: {appenders: ["everything", process.env.DEBUG ? "console" : "consoleNoDebug"], level: "debug"}
    }
});

container.load(buildProviderModule());

async function initialize() {
    const logger = getLogger("bot");
    logger.info("Initializing systems");

    await Cache.getInstance();
    CommandSystem.getInstance();
    Config.getInstance();
    EventSystem.getInstance();
    ExpressionSystem.getInstance();
    FilterSystem.getInstance();
    await LastFMSystem.getInstance();
    PermissionSystem.getInstance();
    SettingsSystem.getInstance();

    logger.info("Initializing service adapter");

    const config = await Config.getInstance().getConfig(GeneralConfig);
    container.bind<string>(symbols.ServiceName).toConstantValue(config.service);
    const app = container.get<Application>(Application);
    container.get<ModuleManager>(ModuleManager);
    return app.start(process.argv)
}

initialize();
