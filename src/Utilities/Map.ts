import {Resolvable, resolve} from "./Interfaces/Resolvable";

export class MapExt<TKey, TValue> extends Map<TKey, TValue> {
    getOrSet(key: TKey, value: Resolvable<TKey, TValue>): TValue {
        if (!this.has(key)) this.set(key, resolve(value, key));
        return this.get(key);
    }
}