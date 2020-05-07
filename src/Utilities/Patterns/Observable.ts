export interface Observer<T> {
    update(observable: Observable<T>, prevValue: T, nextValue: T): void;
}

export interface ObservableFunction<T> {
    (observable: Observable<T>, prevValue: T, nextValue: T): void;
}

class FunctionObserver<T> implements Observer<T> {
    constructor(private func: ObservableFunction<T>) {}

    update(observable: Observable<T>, prevValue: T, nextValue: T): void {
        this.func(observable, prevValue, nextValue);
    }
}

export class Observable<T> {
    private observers: Observer<T>[] = [];

    constructor(protected value: T) {}

    public set(newValue: T): void {
        const oldValue = this.value;
        this.value = newValue;
        for (const observer of this.observers) observer.update(this, oldValue, newValue);
    }

    public get(): T {
        return this.value;
    }

    public attach(observer: Observer<T>|ObservableFunction<T>): Observer<T> {
        if (typeof observer === "function") observer = new FunctionObserver(observer);
        this.observers.push(observer);
        return observer;
    }

    public detach(observer: Observer<T>): void {
        const i = this.observers.indexOf(observer);
        if (i < 0) return;
        this.observers.splice(i, 1);
    }
}

export class ObservableArray<T> extends Observable<T[]> {
    constructor() {
        super([]);
    }

    public add(value: T): void {
        this.addAll([ value ]);
    }

    public addAll(values: T[]): void {
        this.set(this.get().concat(values));
    }

    public remove(value: T): void {
        const copy = this.value.slice();
        const i = copy.indexOf(value);
        if (i < 0) return;
        copy.splice(i, 1);
        this.set(copy);
    }

    public has(value: T): boolean {
        return this.indexOf(value) >= 0;
    }

    public indexOf(value: T): number {
        return this.value.indexOf(value);
    }
}