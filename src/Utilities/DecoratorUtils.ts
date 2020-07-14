import {objectHasProperties} from "./ObjectUtils";

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
    Reflect.defineMetadata(key, target, propertyKey, value);
}

interface KeyValuePair<T> {
    key: string;
    value: T;
}

function isKeyValuePair<T>(obj: unknown): obj is KeyValuePair<T> {
    if (typeof obj !== "object") return false;
    return objectHasProperties(obj, "key", "value");
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

export type TYPE_CONSTRUCTORS = NumberConstructor|StringConstructor|ArrayBufferConstructor|ArrayConstructor|
    BooleanConstructor|DateConstructor|ErrorConstructor|FunctionConstructor|GeneratorFunctionConstructor|MapConstructor|
    ObjectConstructor|PromiseConstructor|RegExpConstructor|SetConstructor|SymbolConstructor;

export function getPropertyType(target: any, property: string): TYPE_CONSTRUCTORS {
    return Reflect.getMetadata("design:type", target, property);
}