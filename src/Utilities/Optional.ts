import {AsyncResolvable, Resolvable, resolve, resolveAsync} from "./Interfaces/Resolvable";

export default class Optional<T> {
    private constructor(private _value: T = null, private _present: boolean = false) {
    }

    public static of<T>(value: T): Optional<T> {
        return new Optional<T>(value, true);
    }

    public static ofNullable<T>(value: T|null): Optional<T> {
        return value === null ? Optional.empty() : Optional.of(value);
    }

    public static empty(): Optional<never> {
        return new Optional<never>();
    }

    public get value(): T {
        return this._value;
    }

    public get present(): boolean {
        return this._present;
    }

    public filter(fun: (value: T) => boolean): Optional<T> {
        return this._present && fun(this._value) ? Optional.of(this._value) : Optional.empty();
    }

    public flatMap<U>(fun: (value: T) => Optional<U>): Optional<U> {
        return this._present ? fun(this._value) : Optional.empty();
    }

    public ifPresent(fun: (value: T) => void): void {
        if (this._present) fun(this._value);
    }

    public map<U>(fun: (value: T) => U): Optional<U> {
        if (!this._present) return Optional.empty();
        const value = fun(this._value);
        if (value === null) return Optional.empty();
        return Optional.of(value);
    }

    public orElse(other: Resolvable<void, T>): T {
        return this._present ? this._value : resolve(other);
    }

    public async orElseAsync(other: AsyncResolvable<void, T>): Promise<T> {
        return this._present ? this._value : await resolveAsync(other);
    }

    public orElseThrow<X extends Error>(resolvable: Resolvable<void, X>): T {
        if (!this._present) throw resolve(resolvable);
        return this._value;
    }
}