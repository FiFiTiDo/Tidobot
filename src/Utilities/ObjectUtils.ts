export function objectHasProperty(object: object, key: string|number): key is keyof object {
    return Object.prototype.hasOwnProperty.call(object, key);
}

export function objectHasProperties(object: object, ...keys: string[]): boolean {
    for (const key of keys)
        if (!objectHasProperty(object, key))
            return false;
    return true;
}