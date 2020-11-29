import _ from "lodash";
import {Logger} from "log4js";
import {parseRole} from "../Systems/Permissions/Role";

interface Function<ReturnT> {
    (...args: any[]): ReturnT;
}

interface ErrorFailFunction<ReturnT> {
    (error: string): ReturnT;
}

export function validateFunction<ReturnT>(func: Function<ReturnT>, argDfn: string[], onFail: ErrorFailFunction<ReturnT>): Function<ReturnT> {
    return function (...inputArgs: unknown[]): ReturnT {
        const args = [];
        for (const [i, arg] of argDfn.entries()) {
            let value = undefined;
            const props = arg.split("|");
            for (const prop of props) {
                const [name, params] = prop.split(":");
                switch (name) {
                    case "role": {
                        if (typeof inputArgs[i] === "undefined") break;
                        if (typeof inputArgs[i] !== "string") return onFail(`Expected argument #${i} to be of type string`);
                        const role = parseRole(inputArgs[i] as string);
                        if (role === null)
                            return onFail(`Expected argument #${i} to be a valid role`);
                        value = role;
                        break;
                    }
                    case "array":
                        if (_.isArray(inputArgs[i]))
                            value = inputArgs[i];
                        else
                            return onFail(`Expected argument #${i} to be of type array`);
                        break;
                    case "string":
                    case "boolean":
                    case "number":
                    case "bigint":
                    case "function":
                    case "object":
                    case "symbol":
                        switch (typeof inputArgs[i]) {
                            case name:
                                value = inputArgs[i];
                                break;
                            case "undefined":
                                break;
                            default:
                                return onFail(`Expected argument #${i} to be of type ${name}`);
                        }
                        break;
                    case "required":
                        if (value === undefined)
                            return onFail("Expected a value for argument #${i}");
                        break;
                    case "min": {
                        const minVal = parseFloat(params);
                        if (typeof value !== "number")
                            return onFail(`min expected a number for argument #${i}`);
                        if (value < minVal)
                            return onFail(`Expected argument #${i} to be greater than ${minVal}`);
                        break;
                    }
                    case "max": {
                        const maxVal = parseFloat(params);
                        if (typeof value !== "number")
                            return onFail(`min expected a number for argument #${i}`);
                        if (value > maxVal)
                            return onFail(`Expected argument #${i} to be less than ${maxVal}`);
                        break;
                    }
                }
            }
            args.push(value);
        }

        return func(...args);
    };
}

export function logWarningOnFail<ReturnT>(logger: Logger, retval: ReturnT): ErrorFailFunction<ReturnT> {
    return function (error: string): ReturnT {
        logger.warn(error);
        return retval;
    };
}

export function logErrorOnFail<ReturnT>(logger: Logger, retval: ReturnT): ErrorFailFunction<ReturnT> {
    return function (error: string): ReturnT {
        logger.error(error);
        return retval;
    };
}

export function logErrorOnFailAsync<ReturnT>(logger: Logger, retval: ReturnT|Promise<ReturnT>): ErrorFailFunction<Promise<ReturnT>> {
    return function (error: string): Promise<ReturnT> {
        logger.error(error);
        return retval instanceof Promise ? retval : Promise.resolve(retval);
    };
}

export function returnError(): ErrorFailFunction<string> {
    return (error: string): string => error;
}

export function returnErrorAsync(): ErrorFailFunction<Promise<string>> {
    return (error: string): Promise<string> => Promise.resolve(error);
}