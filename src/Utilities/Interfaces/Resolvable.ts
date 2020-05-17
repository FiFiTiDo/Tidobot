export type Resolvable<TParam, TValue> = TValue|((param?: TParam) => TValue|Promise<TValue>);
export async function resolve<TParam, TValue>(resolvable: Resolvable<TParam, TValue>, input?: TParam): Promise<TValue> {
    if (resolvable instanceof Function) {
        let value = resolvable(input);
        if (value instanceof Promise) value = await value;
        return value;
    } else {
        return resolvable;
    }
}