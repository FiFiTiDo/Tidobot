export type Resolvable<TParam, TValue> = TValue|Promise<TValue>|((param?: TParam) => TValue|Promise<TValue>);
export async function resolve<TParam, TValue>(resolvable: Resolvable<TParam, TValue>, input?: TParam): Promise<TValue> {
    if (resolvable instanceof Function)
        resolvable = resolvable(input);
    return resolvable instanceof Promise ? await resolvable : resolvable;
}