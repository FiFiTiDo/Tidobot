export function forceCast<T>(object: unknown): T {
    return object as T;
}

export type ValueOf<T> = T[keyof T];