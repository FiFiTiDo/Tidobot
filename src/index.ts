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

require("source-map-support").install({
    hookRequire: true
});

configure({
    appenders: {
        everything: {
            type: "file", base: "logs/application.log", property: "categoryName", extension: ".log",
            maxLogSize: 10485760, backups: 3, compress: true
        },
        console: {
            type: "console"
        },
        consoleNoDebug: {
            type: "logLevelFilter",
            appender: "console",
            level: "info"
        }
    },
    categories: {
        default: {appenders: ["everything", process.env.DEBUG ? "console" : "consoleNoDebug"], level: "debug"}
    }
});

container.load(buildProviderModule());

async function initialize() {
    const logger = getLogger("bot");
    logger.info("Initializing systems");

    await LastFMSystem.getInstance();
    FilterSystem.getInstance();

    logger.info("System initilization completed, loading adapter");

    const config = await Config.getInstance().getConfig(GeneralConfig);
    container.bind<string>(symbols.ServiceName).toConstantValue(config.service);
    const app = container.get<Application>(Application);
    container.get<ModuleManager>(ModuleManager);
    return app.start(process.argv)
}

initialize();
