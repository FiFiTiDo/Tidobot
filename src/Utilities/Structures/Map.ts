import {Resolvable, resolve} from "../Interfaces/Resolvable";

interface FilterFunction<TKey, TValue> {
    (value: TValue, key: TKey, map: MapExt<TKey, TValue>): boolean;
}

export class MapExt<TKey, TValue> extends Map<TKey, TValue> {
    getOrSet(key: TKey, value: Resolvable<TKey, TValue>): TValue {
        if (!this.has(key)) this.set(key, resolve(value, key));
        return this.get(key);
    }

    setNew(key: TKey, value: TValue): void {
        if (!this.has(key)) this.set(key, value);
    }

    filter(func: FilterFunction<TKey, TValue>): this {
        for (const [key, value] of this.entries())
            if (!func(value, key, this))
                this.delete(key);
        return this;
    }
}