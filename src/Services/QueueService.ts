import ChatterEntity from "../Database/Entities/ChatterEntity";
import EntityStateList from "../Database/EntityStateList";
import ChannelEntity from "../Database/Entities/ChannelEntity";
import Optional from "../Utilities/Patterns/Optional";

class Queue {
    private chatters: ChatterEntity[] = [];
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

    public pop(): ChatterEntity | undefined {
        return this.chatters.shift();
    }

    public push(chatter: ChatterEntity): number {
        this.chatters.push(chatter);
        return this.chatters.length - 1;
    }

    public peek(): ChatterEntity | undefined {
        return this.chatters.length < 1 ? undefined : this.chatters[0];
    }

    public find(chatter: ChatterEntity): number {
        return this.chatters.findIndex(other => other.is(chatter));
    }

    public in(chatter: ChatterEntity): boolean {
        return this.find(chatter) !== -1;
    }

    public remove(chatter: ChatterEntity): boolean {
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

export class QueueService {
    private queues: EntityStateList<ChannelEntity, Queue> = new EntityStateList(() => new Queue());

    public getQueue(channel: ChannelEntity): Queue {
        return this.queues.get(channel);
    }

    public getOpenQueue(channel: ChannelEntity): Optional<Queue> {
        return Optional.of(this.getQueue(channel)).filter(queue => queue.isOpen());
    }

    public getClosedQueue(channel: ChannelEntity): Optional<Queue> {
        return Optional.of(this.getQueue(channel)).filter(queue => !queue.isOpen());
    }

    public async joinQueue(chatter: ChatterEntity, channel: ChannelEntity): Promise<number | JoinQueueResponse> {
        const queue = this.getOpenQueue(channel);
        if (!queue.present) return JoinQueueResponse.CLOSED;
        if (queue.value.in(chatter)) return JoinQueueResponse.ALREADY_IN;
        const maxSize = await channel.getSetting("queue.max-size");
        if (queue.value.size() >= maxSize) return JoinQueueResponse.FULL;
        return queue.value.push(chatter);
    }

    public leaveQueue(chatter: ChatterEntity, channel: ChannelEntity): Optional<boolean> {
        return this.getOpenQueue(channel).map(queue => queue.remove(chatter));
    }

    public getPosition(chatter: ChatterEntity, channel: ChannelEntity) {
        return this.getQueue(channel).find(chatter);
    }

    public removeNext(channel: ChannelEntity): Optional<ChatterEntity> {
        return Optional.ofUndefable(this.getQueue(channel).pop());
    }

    public getNext(channel: ChannelEntity): Optional<ChatterEntity> {
        return Optional.ofUndefable(this.getQueue(channel).peek());
    }

    public clearQueue(channel: ChannelEntity): void {
        this.getQueue(channel).clear();
    }

    public openQueue(channel: ChannelEntity): Optional<void> {
        return this.getClosedQueue(channel).map(queue => queue.open());
    }

    public closeQueue(channel: ChannelEntity): Optional<void> {
        return this.getOpenQueue(channel).map(queue => queue.close());
    }
}