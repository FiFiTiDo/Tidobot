import Dictionary from "../../Utilities/Structures/Dictionary";
import {forceCast} from "../../Utilities/functions";
import GenericObject from "../../Utilities/Interfaces/GenericObject";

export type EventMetadata = Dictionary;

export interface EventConstructor<T extends Event<T>> {
    NAME: string;

    new(...args: any[]): T;
}

export interface EventArguments<T extends Event<T>> {
    event: T;
}

export default abstract class Event<T extends Event<T>> {
    private readonly name: string;
    private metadata: EventMetadata = new Dictionary();
    private propagate: boolean;

    protected constructor(name: string) {
        this.name = name;
        this.propagate = true;
    }

    public getEventArgs(): EventArguments<T> {
        return {event: forceCast(this)};
    }

    public getName(): string {
        return this.name;
    }

    public setMetadata(metadata: GenericObject): void {
        this.metadata = new Dictionary(metadata);
    }

    public getMetadata<T>(key: string, defaultValue: T): T {
        return this.metadata.getOrDefault(key, defaultValue) as T;
    }

    public getAllMetadata(): GenericObject {
        return this.metadata.all();
    }

    public stopPropagation() {
        this.propagate = false;
    }

    public isPropagationStopped() {
        return !this.propagate;
    }
}