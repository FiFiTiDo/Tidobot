export type Resolvable<TParam, TValue> = TValue|((param?: TParam) => TValue);
export type AsyncResolvable<TParam, TValue> = TValue|Promise<TValue>|((param?: TParam) => TValue|Promise<TValue>);
export function resolve<TParam, TValue>(resolvable: Resolvable<TParam, TValue>, input?: TParam): TValue {
    return resolvable instanceof Function ? resolvable(input) : resolvable;
}
export async function resolveAsync<TParam, TValue>(resolvable: AsyncResolvable<TParam, TValue>, input?: TParam): Promise<TValue> {
    if (resolvable instanceof Function)
        resolvable = resolvable(input);
    return resolvable instanceof Promise ? await resolvable : resolvable;
}