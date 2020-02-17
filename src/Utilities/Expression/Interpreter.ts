import ExpressionParser from "./Parser";
import {IToken, tokenMatcher} from "chevrotain";
import Dictionary from "../Dictionary";
import * as Token from "./Lexer";

const parser = new ExpressionParser();
const BaseCstVisitor = parser.getBaseCstVisitorConstructor();
export default class ExpressionInterpreter extends BaseCstVisitor {
    constructor() {
        super();

        this.validateVisitor();
    }

    async expression(ctx, expr_ctx: Dictionary) {
        return await this.visit(ctx.orExpression, expr_ctx);
    }

    async orExpression(ctx, expr_ctx: Dictionary) {
        let result = await this.visit(ctx.lhs, expr_ctx);

        if (ctx.rhs) {
            for (let rhsOperand of ctx.rhs) {
                let rhsValue = await this.visit(rhsOperand, expr_ctx);
                result = result || rhsValue;
            }
        }

        return result;
    }

    async andExpression(ctx, expr_ctx: Dictionary) {
        let result = await this.visit(ctx.lhs, expr_ctx);

        if (ctx.rhs) {
            for (let rhsOperand of ctx.rhs) {
                let rhsValue = await this.visit(rhsOperand, expr_ctx);
                result = result && rhsValue;
            }
        }

        return result;
    }

    async additionExpression(ctx, expr_ctx: Dictionary) {
        let result = await this.visit(ctx.lhs, expr_ctx);

        if (ctx.rhs) {
            for (let idx in ctx.rhs) {
                if (!ctx.rhs.hasOwnProperty(idx)) continue;
                let rhsOperator = ctx.AdditionOp[idx];
                let rhsOperand = ctx.rhs[idx];
                let rhsValue = await this.visit(rhsOperand, expr_ctx);

                if (tokenMatcher(rhsOperator, Token.Plus)) {
                    result += rhsValue;
                } else {
                    result -= rhsValue;
                }
            }
        }

        return result;
    }

    async multiplicationExpression(ctx, expr_ctx: Dictionary) {
        let result = await this.visit(ctx.lhs, expr_ctx);

        if (ctx.rhs) {
            for (let idx in ctx.rhs) {
                if (!ctx.rhs.hasOwnProperty(idx)) continue;
                let rhsOperator = ctx.MultiplicationOp[idx];
                let rhsOperand = ctx.rhs[idx];
                let rhsValue = await this.visit(rhsOperand, expr_ctx);

                if (tokenMatcher(rhsOperator, Token.Mult)) {
                    result *= rhsValue;
                } else {
                    result /= rhsValue;
                }
            }
        }

        return result;
    }

    async inExpression(ctx, expr_ctx: Dictionary) {
        let result = await this.visit(ctx.lhs, expr_ctx);

        if (ctx.rhs) {
            let value = await this.visit(ctx.rhs[0], expr_ctx);
            if (typeof value === "string") {
                if (typeof result !== "string") throw new IllegalStateError("string", typeof result, ctx.lhs[0]);

                result = value.indexOf(result) >= 0;
            } else if (Array.isArray(value)) {
                result = value.indexOf(result) >= 0;
            } else {
                throw new IllegalStateError("string or array", typeof value, ctx.rhs[0]);
            }
        }

        return result;
    }

    async matchesExpression(ctx, expr_ctx: Dictionary) {
        let result = await this.visit(ctx.lhs, expr_ctx);

        if (ctx.rhs) {
            let value = await this.visit(ctx.rhs[0], expr_ctx);
            if (typeof value === "string") {
                if (typeof result !== "string") throw new IllegalStateError("string", typeof result, ctx.lhs[0]);

                result = result.match(value);
            } else {
                throw new IllegalStateError("string", typeof value, ctx.rhs[0]);
            }
        }

        return result;
    }

    async notExpression(ctx, expr_ctx: Dictionary) {
        let value = await this.visit(ctx.value, expr_ctx);

        if (ctx.Not) {
            value = !value;
        }

        return value;
    }

    async valueExpression(ctx, expr_ctx: Dictionary) {
        if (ctx.StringLiteral) {
            let str = ctx.StringLiteral[0].image;
            return str.substr(1, str.length - 2);
        } else if (ctx.NumberLiteral) {
            return parseInt(ctx.NumberLiteral[0].image, 10);
        } else if (ctx.Boolean) {
            return tokenMatcher(ctx.Boolean[0], Token.True);
        } else if (ctx.Array) {
            return await this.visit(ctx.Array, expr_ctx);
        } else if (ctx.dotNotation) {
            return await this.visit(ctx.dotNotation, expr_ctx);
        } else if (ctx.parenthesisExpression) {
            return await this.visit(ctx.parenthesisExpression, expr_ctx);
        }
    }

    async valueExpressionList(ctx, expr_ctx: Dictionary) {
        if (!ctx.valueExpression) return [];

        let values = [];
        for (let value of ctx.valueExpression) {
            values.push(await this.visit(value, expr_ctx));
        }
        return values;
    }

    async array(ctx, expr_ctx: Dictionary) {
        return await this.visit(ctx.valueExpressionList, expr_ctx);
    }

    async dotNotation(ctx, expr_ctx: Dictionary) {
        let key = ctx.lhs[0].image;
        let value = expr_ctx.getOrDefault(key);
        if (value === null) throw new UnknownKeyError(key, ctx.lhs[0]);
        if (ctx.rhs) for (let part of ctx.rhs) value = await this.visit(part, {current: value, global: expr_ctx});
        return value;
    }

    async objectAccess(ctx, expr_ctx: { current: unknown, global: Dictionary }) {
        if (typeof expr_ctx.current !== "object") throw new IllegalStateError("object", typeof expr_ctx.current, ctx.Identifier[0]);
        let key = ctx.Identifier[0].image;
        if (!expr_ctx.current.hasOwnProperty(key)) throw new UnknownKeyError(key, ctx.Identifier[0]);
        return expr_ctx.current[key];
    }

    async functionCall(ctx, expr_ctx: { current: unknown, global: Dictionary }) {
        if (typeof expr_ctx.current !== "function") throw new IllegalStateError("function", typeof expr_ctx.current, ctx.Identifier[0]);
        let value = expr_ctx.current.apply(null, await this.visit(ctx.valueExpressionList, expr_ctx.global));
        if (value instanceof Promise) value = await value;
        return value;
    }

    async arrayAccess(ctx, expr_ctx: { current: unknown, global: Dictionary }) {
        if (!Array.isArray(expr_ctx.current)) throw new IllegalStateError("array", typeof expr_ctx.current, ctx.Identifier[0]);
        let i = await this.visit(ctx.valueExpression, expr_ctx.global);
        if (typeof i !== "number") throw new IllegalStateError("number", typeof i, ctx.valueExpression[0]);
        if (i < 0 || i >= expr_ctx.current.length) throw new OutOfBoundsError(i, ctx.NumberLiteral[0]);
        return expr_ctx.current[i];
    }

    async parenthesisExpression(ctx, expr_ctx: Dictionary) {
        return await this.visit(ctx.expression, expr_ctx);
    }
}

class InterpreterError extends Error {
    public token: IToken;

    constructor(message: string, token: IToken) {
        super(message);

        this.token = token;
    }
}

class UnknownKeyError extends InterpreterError {
    constructor(key: string, token: IToken) {
        super("Unknown key " + key + " at " + token.startColumn, token);
    }
}

class OutOfBoundsError extends InterpreterError {
    constructor(index: number, token: IToken) {
        super("Index out of bounds error, index: " + index + " at: " + token.startColumn, token);
    }
}

class IllegalStateError extends InterpreterError {
    constructor(expected: string, given: string, token: IToken) {
        super("Illegal state: Expected " + expected + " but was given " + given + " at " + token.startColumn, token);
    }
}