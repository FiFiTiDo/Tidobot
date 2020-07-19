export default class Optional<T> {
    private constructor(private _value: T = null, private _present: boolean = false) {
    }

    public static of<T>(value: T): Optional<T> {
        return new Optional<T>(value, true);
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
}