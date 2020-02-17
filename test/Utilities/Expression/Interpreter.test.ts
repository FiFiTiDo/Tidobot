import * as Lexer from "../../../src/Utilities/Expression/Lexer";
import ExpressionParser from "../../../src/Utilities/Expression/Parser";
import ExpressionInterpreter from "../../../src/Utilities/Expression/Interpreter";
const lexer = Lexer.default;
import * as chai from 'chai'
import Dictionary from "../../../src/Utilities/Dictionary";
chai.should();

describe("ExpressionInterpreter", function () {
    let parser: ExpressionParser;
    let interpreter: ExpressionInterpreter;

    before(function () {
        parser = new ExpressionParser();
        interpreter = new ExpressionInterpreter();
    });

    describe("#expression", function () {
        it("should interpret the expression correctly", async function () {
            let lexingResult = lexer.tokenize("test[1][2]().hello");
            parser.input = lexingResult.tokens;
            let cst = parser.expression();
            console.log(JSON.stringify(cst));
            let value = await interpreter.visit(cst, new Dictionary({
                hello: {
                    world: async () => {
                        return ["moderator"]
                    }
                },
                foo: [
                    true,
                    false,
                    [
                        false,
                        true
                    ]
                ],
                test: [
                    [
                        "hello",
                        "world"
                    ],
                    [
                        "foo",
                        "bar",
                        function () {
                            return {
                                "hello": "world"
                            }
                        }
                    ]
                ]
            }));
            value.should.eq("world");
        });
    });
});