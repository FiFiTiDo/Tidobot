import { StringLike } from "./Interfaces/StringLike";

export function removePrefix(needle: string, haystack: string): { newString: string; removed: boolean } {
    return haystack.toLowerCase().startsWith(needle.toLowerCase()) ? {
        newString: haystack.substring(needle.length + 1),
        removed: true
    } : {
        newString: haystack,
        removed: false
    };
}

export interface FormatMap { [key: string]: StringLike }

export function stringFormat(format: string, map: FormatMap): string {
    let formatted = format;
    for (const [key, value] of Object.entries(map))
        formatted = formatted.replace(`{{${key}}}`, value.toString());
    return formatted;
}