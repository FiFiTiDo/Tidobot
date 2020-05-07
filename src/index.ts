import "reflect-metadata";
import Application from "./Application/Application";
import container from "./inversify.config";

require("source-map-support").install({
    hookRequire: true
});

const app = container.get<Application>(Application);
app.start(process.argv);
