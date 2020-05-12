import {IToken} from "chevrotain";


export class InterpreterError extends Error {
    constructor(message: string, public token: IToken) {
        super(message);
    }
}

export class UnknownKeyError extends InterpreterError {
    constructor(public key: string, token: IToken) {
        super("Unknown key " + key + " at column " + token.startColumn, token);
    }
}

export class OutOfBoundsError extends InterpreterError {
    constructor(public index: number, token: IToken) {
        super("Index out of bounds error, index: " + index + " at column " + token.startColumn, token);
    }
}

export class IllegalStateError extends InterpreterError {
    constructor(public expected: string, public given: string, token: IToken) {
        super("Illegal state: Expected " + expected + " but was given " + given + " at column " + token.startColumn, token);
    }
}