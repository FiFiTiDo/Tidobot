import Message from "../../../Chat/Message";
import {StringMap, TFunctionKeys} from "i18next";

export class ValidationError extends Error {
    constructor(message: string) {
        super(message);
    }
}

export class InvalidInputError extends ValidationError {
    constructor(message: string) {
        super(message);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async getMessage(message: Message): Promise<string> {
        return this.message;
    }
}

export class TranslateMessageInputError<TKeys extends TFunctionKeys = string,
    TInterpolationMap extends object = StringMap> extends InvalidInputError {

    constructor(private key: TKeys, private opts?: TInterpolationMap) {
        super(`Translated argument, translation key: ${key}`);
    }

    async getMessage(message: Message): Promise<string> {
        return message.response.translate(this.key, this.opts);
    }
}

export class MissingRequiredArgumentError extends InvalidInputError {
    constructor(private argument: string, private type: string, private column: number) {
        super(`Expected argument ${argument} of type ${type} at column ${column}`);
    }

    async getMessage(message: Message): Promise<string> {
        return message.response.translate("command:error.expected-argument", {
            argument: this.argument, type: this.type, column: this.column
        });
    }
}

export class MissingRequiredCliArgumentError extends InvalidInputError {
    constructor(private argument: string, private type: string) {
        super(`Expected argument ${argument} of type ${type}`);
    }

    async getMessage(message: Message): Promise<string> {
        return message.response.translate("command:error.expected-cli-argument", {
            argument: this.argument, type: this.type
        });
    }
}

export class InvalidArgumentError extends InvalidInputError {
    constructor(private argument: string, private type: string, private given: string, private column: number) {
        super(`Expected arg ${argument} to be of type ${type} but was given ${given} at ${column}`);
    }

    async getMessage(message: Message): Promise<string> {
        return message.response.translate("command:error.expected-argument", {
            argument: this.argument, type: this.type, given: this.given, column: this.column
        });
    }
}