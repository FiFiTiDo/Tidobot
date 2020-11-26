import Optional from "../Utilities/Patterns/Optional";
import { Service } from "typedi";
import { EntityStateList } from "../Database/EntityStateList";
import { Channel } from "../Database/Entities/Channel";
import { Chatter } from "../Database/Entities/Chatter";
import QueueModule from "../Modules/QueueModule";

class Queue {
    private chatters: Chatter[] = [];
    private _open = false;

    public open(): void {
        this._open = true;
    }

    public close(): void {
        this._open = false;
    }

    public isOpen(): boolean {
        return this._open;
    }

    public pop(): Chatter | undefined {
        return this.chatters.shift();
    }

    public push(chatter: Chatter): number {
        this.chatters.push(chatter);
        return this.chatters.length - 1;
    }

    public peek(): Chatter | undefined {
        return this.chatters.length < 1 ? undefined : this.chatters[0];
    }

    public find(chatter: Chatter): number {
        return this.chatters.findIndex(other => other.is(chatter));
    }

    public in(chatter: Chatter): boolean {
        return this.find(chatter) !== -1;
    }

    public remove(chatter: Chatter): boolean {
        const i = this.find(chatter);
        if (i < 0) return false;
        this.chatters.splice(i, 1);
        return true;
    }

    public clear(): void {
        this.chatters = [];
    }

    public size(): number {
        return this.chatters.length;
    }
}

export enum JoinQueueResponse {
    CLOSED, ALREADY_IN, FULL
}

@Service()
export class QueueService {
    private queues: EntityStateList<Channel, Queue> = new EntityStateList(() => new Queue());

    public getQueue(channel: Channel): Queue {
        return this.queues.get(channel);
    }

    public getOpenQueue(channel: Channel): Optional<Queue> {
        return Optional.of(this.getQueue(channel)).filter(queue => queue.isOpen());
    }

    public getClosedQueue(channel: Channel): Optional<Queue> {
        return Optional.of(this.getQueue(channel)).filter(queue => !queue.isOpen());
    }

    public async joinQueue(chatter: Chatter, channel: Channel): Promise<number | JoinQueueResponse> {
        const queue = this.getOpenQueue(channel);
        if (!queue.present) return JoinQueueResponse.CLOSED;
        if (queue.value.in(chatter)) return JoinQueueResponse.ALREADY_IN;
        const maxSize = await channel.settings.get(QueueModule.settings.maxSize);
        if (queue.value.size() >= maxSize) return JoinQueueResponse.FULL;
        return queue.value.push(chatter);
    }

    public leaveQueue(chatter: Chatter, channel: Channel): Optional<boolean> {
        return this.getOpenQueue(channel).map(queue => queue.remove(chatter));
    }

    public getPosition(chatter: Chatter, channel: Channel): number {
        return this.getQueue(channel).find(chatter);
    }

    public removeNext(channel: Channel): Optional<Chatter> {
        return Optional.ofUndefable(this.getQueue(channel).pop());
    }

    public getNext(channel: Channel): Optional<Chatter> {
        return Optional.ofUndefable(this.getQueue(channel).peek());
    }

    public clearQueue(channel: Channel): void {
        this.getQueue(channel).clear();
    }

    public openQueue(channel: Channel): Optional<void> {
        return this.getClosedQueue(channel).map(queue => queue.open());
    }

    public closeQueue(channel: Channel): Optional<void> {
        return this.getOpenQueue(channel).map(queue => queue.close());
    }
}