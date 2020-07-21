import moment from "moment";
import {pluralize} from "./functions";

export function parseDuration(duration_str: string): moment.Duration {
    const parts = duration_str.split(/\s/);
    const duration = {
        milliseconds: 0,
        seconds: 0,
        minutes: 0,
        hours: 0,
        days: 0,
        weeks: 0,
        months: 0,
        years: 0
    };

    for (const part of parts) {
        if (part.endsWith("ms")) {
            duration.milliseconds = parseInt(part.substring(0, part.length - 2));
        } else if (part.endsWith("s")) {
            duration.seconds = parseInt(part.substring(0, part.length - 1));
        } else if (part.endsWith("m")) {
            duration.minutes = parseInt(part.substring(0, part.length - 1));
        } else if (part.endsWith("h")) {
            duration.hours = parseInt(part.substring(0, part.length - 1));
        } else if (part.endsWith("d")) {
            duration.days = parseInt(part.substring(0, part.length - 1));
        }
    }

    return moment.duration(duration);
}

export function formatDuration(duration: moment.Duration): string {
    const parts = [];

    if (duration == moment.duration(NaN)) return "Invalid duration.";

    if (duration.asDays() > 0) parts.push(`${duration.asDays()} ${pluralize(duration.asDays(), "day", "days")}`);
    if (duration.hours() > 0) parts.push(`${duration.hours()} ${pluralize(duration.hours(), "hour", "hours")}`);
    if (duration.minutes() > 0) parts.push(`${duration.minutes()} ${pluralize(duration.minutes(), "min", "mins")}`);
    if (duration.seconds() > 0) parts.push(`${duration.seconds()} ${pluralize(duration.seconds(), "sec", "secs")}`);
    if (duration.milliseconds() > 0) parts.push(`${duration.milliseconds()} ms`);

    if (parts.length > 2) {
        parts[parts.length - 1] = "and " + parts[parts.length - 1];
        return parts.join(", ");
    } else if (parts.length == 2) {
        return `${parts[0]} and ${parts[1]}`;
    } else if (parts.length == 1) {
        return parts[0];
    } else {
        return "Invalid duration.";
    }
}