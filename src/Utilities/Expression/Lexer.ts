import {createToken, Lexer} from "chevrotain"

export const Identifier = createToken({name: "Identifier", pattern: /[a-zA-Z]\w*/});

export const StringLiteral = createToken({
    name: "StringLiteral",
    pattern: /".*?"/
});

export const NumberLiteral = createToken({
    name: "NumberLiteral",
    pattern: /\d+/
});

export const Boolean = createToken({
    name: "Boolean",
    pattern: Lexer.NA
});

export const True = createToken({
    name: "True",
    pattern: /true/i,
    categories: Boolean
});

export const False = createToken({
    name: "False",
    pattern: /false/i,
    categories: Boolean
});

export const In = createToken({
    name: "In",
    pattern: /in/i,
    longer_alt: Identifier
});

export const Not = createToken({
    name: "Not",
    pattern: /not/i,
    longer_alt: Identifier
});

export const Equal = createToken({
    name: "Equal",
    pattern: /equal/i,
    longer_alt: Identifier
});

export const And = createToken({
    name: "And",
    pattern: /and/i,
    longer_alt: Identifier
});

export const Or = createToken({
    name: "Or",
    pattern: /or/i,
    longer_alt: Identifier
});

export const Matches = createToken({
    name: "Matches",
    pattern: /matches/i,
    longer_alt: Identifier
});

export const LParen = createToken({name: "LParen", pattern: /\(/});
export const RParen = createToken({name: "RParen", pattern: /\)/});
export const LSquare = createToken({name: "LSquare", pattern: /\[/});
export const RSquare = createToken({name: "RSquare", pattern: /]/});
export const Comma = createToken({name: "Comma", pattern: /,/});
export const Period = createToken({name: "Period", pattern: /./});

export const AdditionOp = createToken({name: "AdditionOp", pattern: Lexer.NA});
export const Plus = createToken({name: "Plus", pattern: /\+/, categories: AdditionOp});
export const Minus = createToken({name: "Minus", pattern: /-/, categories: AdditionOp});

export const MultiplicationOp = createToken({name: "MultiplicationOp", pattern: Lexer.NA});
export const Mult = createToken({name: "Mult", pattern: /\*/, categories: MultiplicationOp});
export const Div = createToken({name: "Div", pattern: /\//, categories: MultiplicationOp});

export const WhiteSpace = createToken({
    name: "WhiteSpace",
    pattern: /\s+/,
    group: Lexer.SKIPPED
});

export const allTokens = [
    WhiteSpace,
    LParen,
    RParen,
    LSquare,
    RSquare,
    AdditionOp,
    Plus,
    Minus,
    MultiplicationOp,
    Mult,
    Div,
    StringLiteral,
    NumberLiteral,
    Boolean,
    True,
    False,
    In,
    Not,
    Equal,
    And,
    Or,
    Matches,
    Identifier,
    Comma,
    Period
];

export default new Lexer(allTokens);