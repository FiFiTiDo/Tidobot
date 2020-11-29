import _ from "lodash";

export function getMetadata<T>(key: string, target: any): T {
    return Reflect.getMetadata(key, target) as T;
}

export function getPropertyMetadata<T>(key: string, target: any, propertyKey: string): T {
    return Reflect.getMetadata(key, target, propertyKey) as T;
}

export function setMetadata<T>(key: string, target: any, value: T): void {
    Reflect.defineMetadata(key, value, target);
}

export function setPropertyMetadata<T>(key: string, target: any, propertyKey: string, value: T): void {
    Reflect.defineMetadata(key, value, target, propertyKey);
}

interface KeyValuePair<T> {
    key: string;
    value: T;
}

function isKeyValuePair<T>(obj: unknown): obj is KeyValuePair<T> {
    if (typeof obj !== "object") return false;
    return _.has(obj, ["key", "value"]);
}

export function addMetadata<T>(metaKey: string, target: any, value: T | KeyValuePair<T>): void {
    let data: any;
    if (isKeyValuePair(value)) {
        data = getMetadata<T>(metaKey, target) || {};
        data[value.key] = value.value;
    } else {
        data = getMetadata<T[]>(metaKey, target) || [];
        data.push(value);
    }
    setMetadata(metaKey, target, data);
}

export function addPropertyMetadata<T>(key: string, target: any, propertyKey: string, value: T): void {
    let data: any;
    if (isKeyValuePair(value)) {
        data = getPropertyMetadata<T>(key, target, propertyKey) || {};
        data[value.key] = value.value;
    } else {
        data = getPropertyMetadata<T[]>(key, target, propertyKey) || [];
        data.push(value);
    }
    setPropertyMetadata(key, target, propertyKey, data);
}

export async function getOrSetProp<T>(obj: object, key: string, f: () => T | Promise<T>): Promise<T> {
    const varKey = "_" + key;
    const prop = Object.getOwnPropertyDescriptor(obj, varKey);
    if (!prop || !prop.value) {
        let value = f();
        if (value instanceof Promise) value = await value;
        Object.defineProperty(obj, varKey, {value, configurable: true, enumerable: true});
    }
    return Object.getOwnPropertyDescriptor(obj, varKey).value;
}