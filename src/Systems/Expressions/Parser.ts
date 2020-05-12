import * as Tokens from "./Lexer";
import {CstParser} from "chevrotain";

export default class ExpressionParser extends CstParser {
    public array = this.RULE("array", (): void => {
        this.CONSUME(Tokens.LSquare);
        this.SUBRULE(this.valueExpressionList);
        this.CONSUME(Tokens.RSquare);
    });
    public objectAccess = this.RULE("objectAccess", (): void => {
        this.CONSUME(Tokens.Period);
        this.CONSUME(Tokens.Identifier);
    });
    public functionCall = this.RULE("functionCall", (): void => {
        this.CONSUME(Tokens.LParen);
        this.SUBRULE(this.valueExpressionList);
        this.CONSUME(Tokens.RParen);
    });
    public dotNotation = this.RULE("dotNotation", (): void => {
        this.CONSUME(Tokens.Identifier, {LABEL: "lhs"});
        this.MANY((): void => {
            this.OR([
                {
                    ALT: (): void => {
                        this.SUBRULE(this.objectAccess, {LABEL: "rhs"});
                    }
                },
                {
                    ALT: (): void => {
                        this.SUBRULE(this.arrayAccess, {LABEL: "rhs"});
                    }
                },
                {
                    ALT: (): void => {
                        this.SUBRULE(this.functionCall, {LABEL: "rhs"});
                    }
                }
            ]);
        });
    });
    public valueExpression = this.RULE("valueExpression", (): void => {
        this.OR([
            {
                ALT: (): void => {
                    this.CONSUME(Tokens.StringLiteral);
                }
            },
            {
                ALT: (): void => {
                    this.CONSUME(Tokens.NumberLiteral);
                }
            },
            {
                ALT: (): void => {
                    this.CONSUME(Tokens.Boolean);
                }
            },
            {
                ALT: (): void => {
                    this.SUBRULE(this.array);
                }
            },
            {
                ALT: (): void => {
                    this.SUBRULE(this.dotNotation);
                }
            },
            {
                ALT: (): void => {
                    this.SUBRULE(this.parenthesisExpression);
                }
            }
        ]);
    });
    public valueExpressionList = this.RULE("valueExpressionList", (): void => {
        this.MANY_SEP({
            SEP: Tokens.Comma,
            DEF: (): void => {
                this.SUBRULE(this.valueExpression);
            }
        });
    });
    public arrayAccess = this.RULE("arrayAccess", (): void => {
        this.CONSUME(Tokens.LSquare);
        this.SUBRULE(this.valueExpression);
        this.CONSUME(Tokens.RSquare);
    });
    public notExpression = this.RULE("notExpression", (): void => {
        this.OR([
            {
                ALT: (): void => {
                    this.CONSUME(Tokens.Not);
                    this.SUBRULE(this.notExpression, {LABEL: "value"});
                }
            },
            {
                ALT: (): void => {
                    this.SUBRULE(this.valueExpression, {LABEL: "value"});
                }
            }
        ]);
    });
    public matchesExpression = this.RULE("matchesExpression", (): void => {
        this.SUBRULE(this.notExpression, {LABEL: "lhs"});
        this.OPTION((): void => {
            this.CONSUME(Tokens.Matches);
            this.SUBRULE2(this.notExpression, {LABEL: "rhs"});
        });
    });
    public inExpression = this.RULE("inExpression", (): void => {
        this.SUBRULE(this.matchesExpression, {LABEL: "lhs"});
        this.OPTION((): void => {
            this.CONSUME(Tokens.In);
            this.SUBRULE2(this.matchesExpression, {LABEL: "rhs"});
        });
    });
    public multiplicationExpression = this.RULE("multiplicationExpression", (): void => {
        this.SUBRULE(this.inExpression, {LABEL: "lhs"});
        this.MANY((): void => {
            this.CONSUME(Tokens.MultiplicationOp);
            this.SUBRULE2(this.inExpression, {LABEL: "rhs"});
        });
    });
    public additionExpression = this.RULE("additionExpression", (): void => {
        this.SUBRULE(this.multiplicationExpression, {LABEL: "lhs"});
        this.MANY((): void => {
            this.CONSUME(Tokens.AdditionOp);
            this.SUBRULE2(this.multiplicationExpression, {LABEL: "rhs"});
        });
    });
    public andExpression = this.RULE("andExpression", (): void => {
        this.SUBRULE(this.additionExpression, {LABEL: "lhs"});
        this.MANY((): void => {
            this.CONSUME(Tokens.And);
            this.SUBRULE2(this.additionExpression, {LABEL: "rhs"});
        });
    });
    public orExpression = this.RULE("orExpression", (): void => {
        this.SUBRULE(this.andExpression, {LABEL: "lhs"});
        this.MANY((): void => {
            this.CONSUME(Tokens.Or);
            this.SUBRULE2(this.andExpression, {LABEL: "rhs"});
        });
    });
    public expression = this.RULE("expression", (): void => {
        this.SUBRULE(this.orExpression);
    });
    public parenthesisExpression = this.RULE("parenthesisExpression", (): void => {
        this.CONSUME(Tokens.LParen);
        this.SUBRULE(this.expression);
        this.CONSUME(Tokens.RParen);
    });

    constructor() {
        super(Tokens.allTokens);

        this.performSelfAnalysis();
    }
}