import ExpressionParser from "./Parser";
import {tokenMatcher} from "chevrotain";
import Dictionary from "../../Utilities/Structures/Dictionary";
import * as Token from "./Lexer";
import {IllegalStateError, OutOfBoundsError, UnknownKeyError} from "./InterpreterErrors";

const parser = new ExpressionParser();
const BaseCstVisitor = parser.getBaseCstVisitorConstructor();
export default class ExpressionInterpreter extends BaseCstVisitor {
    constructor() {
        super();

        this.validateVisitor();
    }

    async expression(ctx, exprCtx: Dictionary) {
        return await this.visit(ctx.orExpression, exprCtx);
    }

    async orExpression(ctx, exprCtx: Dictionary) {
        let result = await this.visit(ctx.lhs, exprCtx);

        if (ctx.rhs) {
            for (const rhsOperand of ctx.rhs) {
                const rhsValue = await this.visit(rhsOperand, exprCtx);
                result = result || rhsValue;
            }
        }

        return result;
    }

    async andExpression(ctx, exprCtx: Dictionary) {
        let result = await this.visit(ctx.lhs, exprCtx);

        if (ctx.rhs) {
            for (const rhsOperand of ctx.rhs) {
                const rhsValue = await this.visit(rhsOperand, exprCtx);
                result = result && rhsValue;
            }
        }

        return result;
    }

    async additionExpression(ctx, exprCtx: Dictionary) {
        let result = await this.visit(ctx.lhs, exprCtx);

        if (ctx.rhs) {
            for (const idx in ctx.rhs) {
                if (!Object.prototype.hasOwnProperty.call(ctx.rhs, idx)) continue;
                const rhsOperator = ctx.AdditionOp[idx];
                const rhsOperand = ctx.rhs[idx];
                const rhsValue = await this.visit(rhsOperand, exprCtx);

                if (tokenMatcher(rhsOperator, Token.Plus)) {
                    result += rhsValue;
                } else {
                    result -= rhsValue;
                }
            }
        }

        return result;
    }

    async multiplicationExpression(ctx, exprCtx: Dictionary) {
        let result = await this.visit(ctx.lhs, exprCtx);

        if (ctx.rhs) {
            for (const idx in ctx.rhs) {
                if (!Object.prototype.hasOwnProperty.call(ctx.rhs, idx)) continue;
                const rhsOperator = ctx.MultiplicationOp[idx];
                const rhsOperand = ctx.rhs[idx];
                const rhsValue = await this.visit(rhsOperand, exprCtx);

                if (tokenMatcher(rhsOperator, Token.Mult)) {
                    result *= rhsValue;
                } else {
                    result /= rhsValue;
                }
            }
        }

        return result;
    }

    async inExpression(ctx, exprCtx: Dictionary) {
        let result = await this.visit(ctx.lhs, exprCtx);

        if (ctx.rhs) {
            const value = await this.visit(ctx.rhs[0], exprCtx);
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

    async matchesExpression(ctx, exprCtx: Dictionary) {
        let result = await this.visit(ctx.lhs, exprCtx);

        if (ctx.rhs) {
            const value = await this.visit(ctx.rhs[0], exprCtx);
            if (typeof value === "string") {
                if (typeof result !== "string") throw new IllegalStateError("string", typeof result, ctx.lhs[0]);

                result = result.match(value);
            } else {
                throw new IllegalStateError("string", typeof value, ctx.rhs[0]);
            }
        }

        return result;
    }

    async notExpression(ctx, exprCtx: Dictionary) {
        let value = await this.visit(ctx.value, exprCtx);
        if (ctx.Not) value = !value;
        return value;
    }

    async valueExpression(ctx, exprCtx: Dictionary) {
        if (ctx.StringLiteral) {
            const str = ctx.StringLiteral[0].image;
            return str.substr(1, str.length - 2);
        } else if (ctx.NumberLiteral) {
            return parseInt(ctx.NumberLiteral[0].image, 10);
        } else if (ctx.Boolean) {
            return tokenMatcher(ctx.Boolean[0], Token.True);
        } else if (ctx.Array) {
            return await this.visit(ctx.Array, exprCtx);
        } else if (ctx.dotNotation) {
            return await this.visit(ctx.dotNotation, exprCtx);
        } else if (ctx.parenthesisExpression) {
            return await this.visit(ctx.parenthesisExpression, exprCtx);
        }
    }

    async valueExpressionList(ctx, exprCtx: Dictionary) {
        if (!ctx.valueExpression) return [];
        const values = [];
        for (const value of ctx.valueExpression) values.push(await this.visit(value, exprCtx));
        return values;
    }

    async array(ctx, exprCtx: Dictionary) {
        return await this.visit(ctx.valueExpressionList, exprCtx);
    }

    async dotNotation(ctx, exprCtx: Dictionary) {
        const key = ctx.lhs[0].image;
        let value = exprCtx.getOrDefault(key);
        if (value === null) throw new UnknownKeyError(key, ctx.lhs[0]);
        if (ctx.rhs) for (const part of ctx.rhs) value = await this.visit(part, {current: value, global: exprCtx});
        return value;
    }

    async objectAccess(ctx, exprCtx: { current: unknown; global: Dictionary }) {
        if (typeof exprCtx.current !== "object") throw new IllegalStateError("object", typeof exprCtx.current, ctx.Identifier[0]);
        const key = ctx.Identifier[0].image;
        if (!Object.prototype.hasOwnProperty.call(exprCtx.current, key)) throw new UnknownKeyError(key, ctx.Identifier[0]);
        return exprCtx.current[key];
    }

    async functionCall(ctx, exprCtx: { current: unknown; global: Dictionary }) {
        if (typeof exprCtx.current !== "function") throw new IllegalStateError("function", typeof exprCtx.current, ctx.Identifier[0]);
        let value = exprCtx.current.apply(null, await this.visit(ctx.valueExpressionList, exprCtx.global));
        if (value instanceof Promise) value = await value;
        return value;
    }

    async arrayAccess(ctx, exprCtx: { current: unknown; global: Dictionary }) {
        if (!Array.isArray(exprCtx.current)) throw new IllegalStateError("array", typeof exprCtx.current, ctx.Identifier[0]);
        const i = await this.visit(ctx.valueExpression, exprCtx.global);
        if (typeof i !== "number") throw new IllegalStateError("number", typeof i, ctx.valueExpression[0]);
        if (i < 0 || i >= exprCtx.current.length) throw new OutOfBoundsError(i, ctx.NumberLiteral[0]);
        return exprCtx.current[i];
    }

    async parenthesisExpression(ctx, exprCtx: Dictionary) {
        return await this.visit(ctx.expression, exprCtx);
    }
}