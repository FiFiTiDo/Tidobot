import {IToken} from "chevrotain";


export class InterpreterError extends Error {
    public token: IToken;

    constructor(message: string, token: IToken) {
        super(message);

        this.token = token;
    }
}

export class UnknownKeyError extends InterpreterError {
    constructor(key: string, token: IToken) {
        super("Unknown key " + key + " at column " + token.startColumn, token);
    }
}

export class OutOfBoundsError extends InterpreterError {
    constructor(index: number, token: IToken) {
        super("Index out of bounds error, index: " + index + " at column " + token.startColumn, token);
    }
}

export class IllegalStateError extends InterpreterError {
    constructor(expected: string, given: string, token: IToken) {
        super("Illegal state: Expected " + expected + " but was given " + given + " at column " + token.startColumn, token);
    }
}