export function array_rand<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
}

export function array_find<T>(needle: T, haystack: T[]): number {
    return haystack.indexOf(needle);
}

export function array_contains<T>(needle: T, haystack: T[]): boolean {
    return array_find(needle, haystack) >= 0;
}

export function array_add<T>(value: T, arr: T[]): boolean {
    if (array_contains(value, arr)) return false;
    arr.push(value);
    return true;
}

export function array_remove<T>(value: T, arr: T[]): boolean {
    const i = array_find(value, arr);
    if (i < 0) return false;
    arr.splice(i, 1);
    return true;
}

export function tuple<T extends any[]>(...arr: T): T {
    return arr;
}