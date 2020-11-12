import _ from "lodash";

export class ExtraKey<T> {
    constructor(public readonly tag: string) {}
}

export class EventExtra {
    constructor(private readonly data: { [key: string]: any } = {}) {

    }

    public get<T>(key: ExtraKey<T>): T {
        return this.data[key.tag];
    }

    public put<T>(key: ExtraKey<T>, value: T): void {
        this.data[key.tag] = value;
    }

    public putAll(extra: EventExtra): void {
        Object.assign(this.data, extra.data);
    }

    public clone(): EventExtra {
        return new EventExtra(_.cloneDeep(this.data));
    }
}