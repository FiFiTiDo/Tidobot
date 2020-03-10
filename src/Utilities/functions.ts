import * as winston from "winston";
import * as util from "util";
import moment from "moment"
import Application from "../Application/Application";
import Channel from "../Chat/Channel";

export function split(text) {
    let parts = [];
    let sequence: string[] = text.split(/\s*(\${.*?})\s*/g).filter(Boolean);

    for (let part of sequence) {
        if (part.startsWith('${')) {
            parts.push(part);
        } else {
            parts = parts.concat(part.split(/\s/));
        }
    }

    return parts;
}

export function array_rand(array: any[]) {
    return array[Math.floor(Math.random() * array.length)];
}

export function generate_random_code(length: number) {
    let text = "";
    let possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".split("");

    for (let i = 0; i < length; i++) text += array_rand(possible);

    return text;
}

export const error_format = winston.format(info => {
    if (info.cause && info.cause instanceof Error) {
        if (info.cause instanceof Error) {
            info.message = util.format("%s, caused by:\n%s", info.message, info.cause.stack);
        } else {
            info.message = util.format("%s, caused by:\n%s", info.message, info.cause);
        }
        delete info.cause;
    }

    return info;
});

export function __raw(key: string): any {
    return Application.getTranslator().getLanguage(Application.getConfig().getOrDefault("general.lang", "en")).getOrDefault(key);
}

export function __(key: string, ...args): string {
    return util.format(__raw(key), ...args);
}

export function generic_error_message(): string {
    return array_rand(__raw("general.generic_error"));
}

export function clone(obj: any) {
    return JSON.parse(JSON.stringify(obj));
}

export function parse_duration(duration_str: string): moment.Duration {
    let parts = duration_str.split(/\s/);
    let duration = {
        milliseconds: 0,
        seconds: 0,
        minutes: 0,
        hours: 0,
        days: 0,
        weeks: 0,
        months: 0,
        years: 0
    };

    for (let part of parts) {
        if (part.endsWith('ms')) {
            duration.milliseconds = parseInt(part.substring(0, part.length - 2));
        } else if (part.endsWith('s')) {
            duration.seconds = parseInt(part.substring(0, part.length - 1));
        } else if (part.endsWith('m')) {
            duration.minutes = parseInt(part.substring(0, part.length - 1));
        } else if (part.endsWith('h')) {
            duration.hours = parseInt(part.substring(0, part.length - 1));
        } else if (part.endsWith('d')) {
            duration.days = parseInt(part.substring(0, part.length - 1));
        }
    }

    return moment.duration(duration);
}

export function format_duration(duration: moment.Duration): string {
    let parts = [];

    if (duration == moment.duration(NaN)) return 'Invalid duration.';

    if (duration.asDays() > 0) parts.push(`${duration.asDays()} ${pluralize(duration.asDays(), "day", "days")}`);
    if (duration.hours() > 0) parts.push(`${duration.hours()} ${pluralize(duration.hours(), "hour", "hours")}`);
    if (duration.minutes() > 0) parts.push(`${duration.minutes()} ${pluralize(duration.minutes(), "min", "mins")}`);
    if (duration.seconds() > 0) parts.push(`${duration.seconds()} ${pluralize(duration.seconds(), "sec", "secs")}`);
    if (duration.milliseconds() > 0) parts.push(`${duration.milliseconds()} ms`);

    if (parts.length > 2) {
        parts[parts.length - 1] = 'and ' + parts[parts.length - 1];
        return parts.join(', ');
    } else if (parts.length == 2) {
        return `${parts[0]} and ${parts[1]}`;
    } else if (parts.length == 1) {
        return parts[0];
    } else {
        return 'Invalid duration.';
    }
}


export const pluralize = (value: number, singular: string, plural: string) => (Math.abs(value) > 0 && Math.abs(value) <= 1) ? singular : plural;

export function spam_message(text: string, channel: Channel, times: number, seconds = 1) {
    const send = async () => {
        await Application.getAdapter().sendMessage(text, channel);
        if (--times > 0)
            setTimeout(send, seconds * 1000);
    };
    return send();
}

export function parseBool(value: string): boolean | null {
    if (["true", "t", "yes", "y", "on", "enable", "enabled", "1"].indexOf(value) >= 0) {
        return true;
    } else if (["false", "f", "no", "n", "off", "disable", "disabled", "0"].indexOf(value) >= 0) {
        return false;
    } else {
        return null;
    }
}

export function parseStringAs(value: string, type: string): unknown {
    let newVal: any;
    switch (type) {
        case "integer":
            newVal = parseInt(value);
            if (isNaN(newVal))
                throw new Error("Invalid setting value, expected an integer but was given " + value);
            break;
        case "float":
            newVal = parseFloat(value);
            if (isNaN(newVal))
                throw new Error("Invalid setting value, expected a float but was given " + value);
            break;
        case "boolean":
            newVal =  parseBool(value);
            if (newVal === null)
                throw new Error("Invalid setting value, expected a boolean but was given " + value);
            break;
    }
    return newVal;
}

export async function getOrSetProp<T>(obj: Object, key: string, f: () => T | Promise<T>) {
    let varKey = "_" + key;
    let prop = Object.getOwnPropertyDescriptor(obj, varKey);
    if (!prop || !prop.value) {
        let value = f();
        if (value instanceof Promise) await value;
        Object.defineProperty(obj, varKey, { value, configurable: true, enumerable: true });
    }
    return Object.getOwnPropertyDescriptor(obj, varKey).value;
}