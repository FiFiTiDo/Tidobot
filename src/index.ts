import Application from "./Application/Application";
import TwitchAdapter from "./Services/Twitch/TwitchAdapter";

require('source-map-support').install({
    hookRequire: true
});

let app = new Application();
app.registerAdapter("twitch", new TwitchAdapter());
app.start(process.argv);
