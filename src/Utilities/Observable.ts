export class Observable<T> {
    private observers: Observer<T>[] = [];

    constructor(protected value: T) {}

    public set(newValue: T): void {
        let oldValue = this.value;
        this.value = newValue;
        for (let observer of this.observers) observer.update(this, oldValue, newValue);
    }

    public get(): T {
        return this.value;
    }

    public attach(observer: Observer<T>|ObservableFunction<T>): Observer<T> {
        if (typeof observer === "function") observer = new FunctionObserver(observer);
        this.observers.push(observer);
        return observer;
    }

    public detach(observer: Observer<T>) {
        let i = this.observers.indexOf(observer);
        if (i < 0) return;
        this.observers.splice(i, 1);
    }
}

export class ObservableArray<T> extends Observable<T[]> {
    constructor() {
        super([]);
    }

    public add(value: T) {
        this.addAll([ value ]);
    }

    public addAll(values: T[]) {
        this.set(this.get().concat(values));
    }

    public remove(value: T) {
        let copy = this.value.slice();
        let i = copy.indexOf(value);
        if (i < 0) return;
        copy.splice(i, 1);
        this.set(copy);
    }

    public has(value: T) {
        return this.indexOf(value) >= 0;
    }

    public indexOf(value: T) {
        return this.value.indexOf(value);
    }
}

export interface Observer<T> {
    update(observable: Observable<T>, prevValue: T, nextValue: T): void;
}

class FunctionObserver<T> implements Observer<T> {
    constructor(private func: ObservableFunction<T>) {}

    update(observable: Observable<T>, prevValue: T, nextValue: T): void {
        this.func(observable, prevValue, nextValue);
    }
}

export type ObservableFunction<T> = (observable: Observable<T>, prevValue: T, nextValue: T) => void;