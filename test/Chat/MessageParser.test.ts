import "mocha"
import {expect} from "chai";
import MessageParser from "../../src/Chat/MessageParser";

describe("MessageParser", function () {
    describe("#parse", function () {
        it('should split words', function () {
            expect(MessageParser.parse("foo bar baz qux")).to.deep.eq(["foo", "bar", "baz", "qux"])
        });

        it('should should respect escapes', function () {
            expect(MessageParser.parse("hello\\ world")).to.be.an("array").and.contain("hello world");
            expect(MessageParser.parse("\"string message\\\" with a quote\"")).to.be.an("array").and.contain("string message\" with a quote");
            expect(MessageParser.parse("${escape sequence too!\\}}")).to.be.an("array").and.contain("${escape sequence too!}}");
        });

        it('should respect quotes', function () {
            const input = MessageParser.parse("hello world \"This is a quoted segment\" testing");
            const expected = ["hello", "world", "This is a quoted segment", "testing"];

            expect(input).to.deep.eq(expected)
        });

        it('should respect escape sequences', function () {
            const input = MessageParser.parse("!test argument ${testShouldPass.blah().yo matches \"yes\"}");
            const expected = ["!test", "argument", "${testShouldPass.blah().yo matches \"yes\"}"];

            expect(input).to.deep.eq(expected)
        });
    });
});