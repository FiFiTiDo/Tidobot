import Message from "../../../Chat/Message";

export class ValidationError extends Error {
    constructor(message: string) {
        super(message);
    }
}

export class InvalidOptionError extends ValidationError {
    constructor(message: string) {
        super(message);
    }
}

export class InvalidInputError extends ValidationError {
    constructor(message: string) {
        super(message);
    }

    async getMessage(message: Message, usage: string): Promise<string> {
        return this.message;
    }
}

export class ExpectedTokenError extends InvalidInputError {
    constructor(private tokenType: string, private token: string, private column: number) {
        super(`Expected token ${tokenType} (${token}) at column ${column}`);
    }

    async getMessage(message: Message, usage: string): Promise<string> {
        return message.getResponse().translate("command:error.expected-token", {
            tokenType: this.tokenType, token: this.token, column: this.column
        })
    }
}

export class MissingRequiredArgumentError extends InvalidInputError {
    constructor(private argument: string, private type: string, private column: number) {
        super(`Expected argument ${argument} of type ${type} at column ${column}`);
    }

    async getMessage(message: Message, usage: string): Promise<string> {
        return message.getResponse().translate("command:error.expected-argument", {
            argument: this.argument, type: this.type, column: this.column
        })
    }
}

export class MissingRequiredCliArgumentError extends InvalidInputError {
    constructor(private argument: string, private type: string) {
        super(`Expected argument ${argument} of type ${type}`);
    }

    async getMessage(message: Message, usage: string): Promise<string> {
        return message.getResponse().translate("command:error.expected-cli-argument", {
            argument: this.argument, type: this.type
        })
    }
}

export class InvalidArgumentError extends InvalidInputError {
    constructor(private argument: string, private type: string, private given: string, private column: number) {
        super(`Expected arg ${argument} to be of type ${type} but was given ${given} at ${column}`);
    }

    async getMessage(message: Message, usage: string): Promise<string> {
        return message.getResponse().translate("command:error.expected-argument", {
            argument: this.argument, type: this.type, given: this.given, column: this.column
        });
    }
}