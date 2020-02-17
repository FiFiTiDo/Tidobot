import Dictionary, {IDictionary} from "../Utilities/Dictionary";

export type EventMetadata = Dictionary

export interface EventConstructor<T extends Event<T>> {
    NAME: string;
}

export default abstract class Event<T extends Event<T>> {
    private readonly name: string;
    private metadata: EventMetadata = new Dictionary();
    private propagate: boolean;

    protected constructor(name: string) {
        this.name = name;
        this.propagate = true;
    }

    public getName(): string {
        return this.name;
    }

    public setMetadata(metadata: IDictionary): void {
        this.metadata = new Dictionary(metadata);
    }

    public getMetadata<T>(key: string, defaultValue: T): T {
        return this.metadata.getOrDefault(key, defaultValue) as T;
    }

    public getAllMetadata(): IDictionary {
        return this.metadata.all();
    }

    public stopPropagation() {
        this.propagate = false;
    }

    public isPropagationStopped() {
        return !this.propagate;
    }
}