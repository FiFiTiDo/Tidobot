import ValidationStrategy, {
    CommandEventValidatorOptions,
    ValidatorResponse,
    ValidatorStatus
} from "./ValidationStrategy";
import {CommandEvent} from "../../CommandEvent";
import {resolve} from "../../../../Utilities/Interfaces/Resolvable";
import {InvalidInputError} from "../ValidationErrors";

export default class StandardValidationStrategy<T extends unknown[]> implements ValidationStrategy<T> {
    constructor(private opts: CommandEventValidatorOptions<T>) {
    }

    async validate(event: CommandEvent): Promise<ValidatorResponse<T>> {
        const message = event.getMessage();
        const rawArgs = event.getArguments();
        const args: T = [] as T;
        const silent = this.opts.silent || false;

        if (this.opts.permission && !(await message.checkPermission(await resolve(this.opts.permission, rawArgs))))
            return {status: ValidatorStatus.NOT_PERMITTED, args: null};

        if (this.opts.arguments) {
            let currIndex = 0;
            for (const arg of this.opts.arguments) {
                try {
                    const { newIndex, converted } = await resolve(arg.converter(rawArgs, currIndex, message));
                    currIndex = newIndex;
                    args.push(converted);
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

        if (this.opts.price && !(await message.getChatter().charge(this.opts.price)))
            return { status: ValidatorStatus.LOW_BALANCE, args: null };

        return {
            status: ValidatorStatus.OK, args
        }
    }
}