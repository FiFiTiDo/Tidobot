export default class PriorityList<ValueT> {
    private readonly items: { [key: number]: ValueT[] };
    private priorities: number[];

    constructor() {
        this.items = {};
        this.priorities = [];
    }

    push(value: ValueT, priority: number): void {
        if (!Object.prototype.hasOwnProperty.call(this.items, priority)) {
            this.items[priority] = [];
            this.priorities.push(priority);
            this.priorities = this.priorities.sort((a, b) => b - a);
        }

        this.items[priority].push(value);
    }

    remove(value: ValueT): void {
        for (const priority of this.priorities) {
            let i;
            while ((i = this.items[priority].indexOf(value)) >= 0)
                this.items[priority].splice(i, 1);
        }
    }

    pop(): ValueT | undefined {
        for (const priority of this.priorities)
            if (this.items[priority].length > 0)
                return this.items[priority].pop();
        return undefined;
    }

    * [Symbol.iterator](): IterableIterator<ValueT> {
        for (const priority of this.priorities)
            for (const value of this.items[priority])
                yield value;
    }
}