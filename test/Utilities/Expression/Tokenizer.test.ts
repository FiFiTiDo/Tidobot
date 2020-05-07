import * as Lexer from "../../../src/Systems/Expressions/Lexer";
const lexer = Lexer.default;
import * as chai from 'chai'
chai.should();

describe("ExpressionLexer", function() {
    describe("#tokenize", function() {
       it("should tokenize simple expressions", function() {
            let result = lexer.tokenize("not true and false");
            let tokens = result.tokens;

            tokens.length.should.eq(4);
            tokens[0].tokenType.name.should.eq("Not");
            tokens[1].tokenType.name.should.eq("True");
            tokens[2].tokenType.name.should.eq("And");
            tokens[3].tokenType.name.should.eq("False");
       });
        it("should tokenize complex expressions", function() {
            let result = lexer.tokenize("levels.moderator in user.getLevels() and channel.title matches \"/minecraft/\"");
            let tokens = result.tokens;

            tokens.length.should.eq(15);
            tokens[0].tokenType.name.should.eq("Identifier");
            tokens[1].tokenType.name.should.eq("Period");
            tokens[2].tokenType.name.should.eq("Identifier");
            tokens[3].tokenType.name.should.eq("In");
            tokens[4].tokenType.name.should.eq("Identifier");
            tokens[5].tokenType.name.should.eq("Period");
            tokens[6].tokenType.name.should.eq("Identifier");
            tokens[7].tokenType.name.should.eq("LParen");
            tokens[8].tokenType.name.should.eq("RParen");
            tokens[9].tokenType.name.should.eq("And");
            tokens[10].tokenType.name.should.eq("Identifier");
            tokens[11].tokenType.name.should.eq("Period");
            tokens[12].tokenType.name.should.eq("Identifier");
            tokens[13].tokenType.name.should.eq("Matches");
            tokens[14].tokenType.name.should.eq("StringLiteral");
        });
    });
});
