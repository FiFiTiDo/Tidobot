import Timer = NodeJS.Timer;
import Timeout = NodeJS.Timeout;
import System from "../System";
import { Service } from "typedi";
import { setTimeout } from "timers";

@Service()
export default class TimerSystem extends System {
    private static instance: TimerSystem = null;
    private readonly timers: Timer[] = [];
    private readonly timeouts: Timeout[] = [];

    private constructor() {
        super("Timer");
    }

    public static getInstance(): TimerSystem {
        if (this.instance === null)
            this.instance = new TimerSystem();
        return this.instance;
    }

    public startTimeout<T extends any[]>(fun: (...args: T) => void, ms: number, ...args: T): Timeout {
        const timeout = setTimeout(() => fun(...args), ms);
        this.timeouts.push(timeout);
        return timeout;
    }

    public cancelTimeout(timeout: Timeout): void {
        clearTimeout(timeout);
    }

    public startTimer<T extends any[]>(fun: (...args: T) => void, ms: number, ...args: T): Timer {
        const timer = setInterval(() => fun(...args), ms);
        this.timers.push(timer);
        return timer;
    }

    public stopTimer(timer: Timer): void {
        clearInterval(timer);
    }

    public shutdown(): void {
        this.timers.forEach(this.stopTimer);
        this.timeouts.forEach(this.cancelTimeout);
    }
}

export class TimeUnit {
    static readonly Seconds = (seconds: number): number => seconds * 1000;
    static readonly Minutes = (minutes: number): number => TimeUnit.Seconds(minutes * 60);
    static readonly Hours = (hours: number): number => TimeUnit.Minutes(hours * 60);
    static readonly Days = (days: number): number => TimeUnit.Hours(days * 24);
}