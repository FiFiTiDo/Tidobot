import "reflect-metadata";
import Application from "./Application/Application";
import container from "./inversify.config";
import {buildProviderModule} from "inversify-binding-decorators";
import ModuleManager from "./Modules/ModuleManager";

require("dotenv").config();
require("source-map-support").install({
    hookRequire: true
});

container.load(buildProviderModule());

const app = container.get<Application>(Application);
container.get<ModuleManager>(ModuleManager);
app.start(process.argv);
