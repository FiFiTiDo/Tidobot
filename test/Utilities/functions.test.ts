import * as functions from "../../src/Utilities/functions"
import chai = require("chai");
import sinon = require("sinon");
import sinonChai = require("sinon-chai");

chai.should();
chai.use(sinonChai);

describe("functions", function () {
    describe("split", function () {
        it("should split strings correctly", function () {
            let input = "hello ${\"moderator\" in user.getLevels()} lorem ipsum dolar sit amet";
            let output = functions.split(input);
            let expected = ["hello", "${\"moderator\" in user.getLevels()}", "lorem", "ipsum", "dolar", "sit", "amet"];

            output.should.deep.eq(expected);
        });
    });
});