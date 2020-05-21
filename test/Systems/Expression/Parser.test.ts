import * as Lexer from "../../../src/Systems/Expressions/Lexer";
import ExpressionParser from "../../../src/Systems/Expressions/Parser";
const lexer = Lexer.default;
import * as chai from 'chai'
chai.should();

describe("ExpressionParser", function () {
    let parser;

    before(function() {
        parser = new ExpressionParser();
    });

    describe("#expression", function () {
        it("should not fail to parse the expression", function () {
            let lexingResult = lexer.tokenize("hello.world.func(\"string\", 42, foo.bar()) and not (permission.levels.banned in user.getLevels())");

            parser.input = lexingResult.tokens;
            if (parser.errors.length > 0) {
                for (let error of parser.errors)
                    console.error(error.message);
            }
            parser.errors.length.should.be.lt(1);
        });
    });
});