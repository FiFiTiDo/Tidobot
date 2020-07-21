export function arrayRand<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
}

export function arrayFind<T>(needle: T, haystack: T[]): number {
    return haystack.indexOf(needle);
}

export function arrayContains<T>(needle: T, haystack: T[]): boolean {
    return arrayFind(needle, haystack) >= 0;
}

export function arrayAdd<T>(value: T, arr: T[]): boolean {
    if (arrayContains(value, arr)) return false;
    arr.push(value);
    return true;
}

export function arrayRemove<T>(value: T, arr: T[]): boolean {
    const i = arrayFind(value, arr);
    if (i < 0) return false;
    arr.splice(i, 1);
    return true;
}
