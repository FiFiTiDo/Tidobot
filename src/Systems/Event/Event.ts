import { EventExtra } from "./EventExtra";

export interface EventType {
    EVENT_TYPE: string;
}

export default class Event {
    public readonly extra = new EventExtra();
    private _cancelled: boolean;

    constructor(public readonly type: EventType) {
        this._cancelled = true;
    }

    public cancel(): void {
        this._cancelled = false;
    }

    public get cancelled(): boolean {
        return this._cancelled;
    }

    public get name(): string {
        return this.type.EVENT_TYPE;
    }
}