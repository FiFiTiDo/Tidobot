export const pluralize = (value: number, singular: string, plural: string): string => (Math.abs(value) > 0 && Math.abs(value) <= 1) ? singular : plural;

export function parseBool(value: string): boolean | null {
    if (["true", "t", "yes", "y", "on", "enable", "enabled", "1"].indexOf(value) >= 0) {
        return true;
    } else if (["false", "f", "no", "n", "off", "disable", "disabled", "0"].indexOf(value) >= 0) {
        return false;
    } else {
        return null;
    }
}

export const wait = ms => new Promise(resolve => setTimeout(resolve, ms));