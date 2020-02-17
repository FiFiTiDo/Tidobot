import * as Tokens from "./Lexer"
import {CstParser} from "chevrotain";

export default class ExpressionParser extends CstParser {
    public valueExpressionList = this.RULE("valueExpressionList", () => {
        this.MANY_SEP({
            SEP: Tokens.Comma,
            DEF: () => {
                this.SUBRULE(this.valueExpression)
            }
        });
    });
    public array = this.RULE("array", () => {
        this.CONSUME(Tokens.LSquare);
        this.SUBRULE(this.valueExpressionList);
        this.CONSUME(Tokens.RSquare);
    });
    public objectAccess = this.RULE("objectAccess", () => {
        this.CONSUME(Tokens.Period);
        this.CONSUME(Tokens.Identifier);
    });
    public arrayAccess = this.RULE("arrayAccess", () => {
        this.CONSUME(Tokens.LSquare);
        this.SUBRULE(this.valueExpression);
        this.CONSUME(Tokens.RSquare);
    });
    public functionCall = this.RULE("functionCall", () => {
        this.CONSUME(Tokens.LParen);
        this.SUBRULE(this.valueExpressionList);
        this.CONSUME(Tokens.RParen);
    });
    public dotNotation = this.RULE("dotNotation", () => {
        this.CONSUME(Tokens.Identifier, {LABEL: "lhs"});
        this.MANY(() => {
            this.OR([
                {ALT: () => this.SUBRULE(this.objectAccess, {LABEL: "rhs"})},
                {ALT: () => this.SUBRULE(this.arrayAccess, {LABEL: "rhs"})},
                {ALT: () => this.SUBRULE(this.functionCall, {LABEL: "rhs"})}
            ]);
        });
    });
    public parenthesisExpression = this.RULE("parenthesisExpression", () => {
        this.CONSUME(Tokens.LParen);
        this.SUBRULE(this.expression);
        this.CONSUME(Tokens.RParen);
    });
    public valueExpression = this.RULE("valueExpression", () => {
        this.OR([
            {ALT: () => this.CONSUME(Tokens.StringLiteral)},
            {ALT: () => this.CONSUME(Tokens.NumberLiteral)},
            {ALT: () => this.CONSUME(Tokens.Boolean)},
            {ALT: () => this.SUBRULE(this.array)},
            {ALT: () => this.SUBRULE(this.dotNotation)},
            {ALT: () => this.SUBRULE(this.parenthesisExpression)}
        ]);
    });
    public notExpression = this.RULE("notExpression", () => {
        this.OR([
            {
                ALT: () => {
                    this.CONSUME(Tokens.Not);
                    this.SUBRULE(this.notExpression, {LABEL: "value"})
                }
            },
            {ALT: () => this.SUBRULE(this.valueExpression, {LABEL: "value"})}
        ]);
    });
    public matchesExpression = this.RULE("matchesExpression", () => {
        this.SUBRULE(this.notExpression, {LABEL: "lhs"});
        this.OPTION(() => {
            this.CONSUME(Tokens.Matches);
            this.SUBRULE2(this.notExpression, {LABEL: "rhs"});
        });
    });
    public inExpression = this.RULE("inExpression", () => {
        this.SUBRULE(this.matchesExpression, {LABEL: "lhs"});
        this.OPTION(() => {
            this.CONSUME(Tokens.In);
            this.SUBRULE2(this.matchesExpression, {LABEL: "rhs"});
        });
    });
    public multiplicationExpression = this.RULE("multiplicationExpression", () => {
        this.SUBRULE(this.inExpression, {LABEL: "lhs"});
        this.MANY(() => {
            this.CONSUME(Tokens.MultiplicationOp);
            this.SUBRULE2(this.inExpression, {LABEL: "rhs"});
        });
    });
    public additionExpression = this.RULE("additionExpression", () => {
        this.SUBRULE(this.multiplicationExpression, {LABEL: "lhs"});
        this.MANY(() => {
            this.CONSUME(Tokens.AdditionOp);
            this.SUBRULE2(this.multiplicationExpression, {LABEL: "rhs"});
        });
    });
    public andExpression = this.RULE("andExpression", () => {
        this.SUBRULE(this.additionExpression, {LABEL: "lhs"});
        this.MANY(() => {
            this.CONSUME(Tokens.And);
            this.SUBRULE2(this.additionExpression, {LABEL: "rhs"});
        });
    });
    public orExpression = this.RULE("orExpression", () => {
        this.SUBRULE(this.andExpression, {LABEL: "lhs"});
        this.MANY(() => {
            this.CONSUME(Tokens.Or);
            this.SUBRULE2(this.andExpression, {LABEL: "rhs"});
        });
    });
    public expression = this.RULE("expression", () => {
        this.SUBRULE(this.orExpression);
    });

    constructor() {
        super(Tokens.allTokens);

        this.performSelfAnalysis();
    }
}