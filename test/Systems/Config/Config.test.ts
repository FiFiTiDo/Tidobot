import "reflect-metadata";
import Config from "../../../src/Systems/Config/Config";
import TwitchConfig from "../../../src/Systems/Config/ConfigModels/TwitchConfig";
import {expect} from "chai";

describe("Config", function () {
    describe("#getConfig", function () {
        it("should load the config file", async function () {
            const twitchConfig = await Config.getInstance().getConfig(TwitchConfig);
            expect(twitchConfig.defaultChannels).to.deep.eq(["fifitido"]);
        });
    });
});