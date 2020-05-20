import ValidationStrategy, {
    CommandEventValidatorOptions,
    ValidatorResponse,
    ValidatorStatus
} from "./ValidationStrategy";
import {CommandEvent} from "../../CommandEvent";
import {resolve} from "../../../../Utilities/Interfaces/Resolvable";
import {InvalidInputError} from "../ValidationErrors";
import minimist = require("minimist-string");

interface CliArguments {
    [key: string]: any
}

export default class CliArgsValidationStrategy<T extends CliArguments> implements ValidationStrategy<T> {
    constructor(private opts: CommandEventValidatorOptions<T>) {
    }

    async validate(event: CommandEvent): Promise<ValidatorResponse<T>> {
        const message = event.getMessage();
        const rawArgs = minimist(event.getArguments().join(" "));
        const args = {};
        const silent = this.opts.silent || false;

        if (this.opts.permission && !(await message.checkPermission(await resolve(this.opts.permission, rawArgs)))) {
            return {
                status: ValidatorStatus.NOT_PERMITTED,
                args: null
            }
        }

        if (this.opts.arguments) {
            for (const [key, arg] of Object.entries(this.opts.arguments)) {
                try {
                    const parts = rawArgs[key] || [];
                    const { converted } = await resolve(arg(parts, 0, message));
                    args[key] = converted;
                } catch (err) {
                    if (err instanceof InvalidInputError) {
                        if (!silent)
                            await message.getResponse().rawMessage(await err.getMessage(message, this.opts.usage));
                        return { status: ValidatorStatus.INVALID_ARGS, args: null };
                    } else {
                        if (!silent)
                            await message.getResponse().genericError();
                        return { status: ValidatorStatus.ERROR, args: null };
                    }
                }
            }
        }

        return {
            status: ValidatorStatus.OK, args: args as any
        }
    }
}