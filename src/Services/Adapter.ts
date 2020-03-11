import Dispatcher from "../Event/Dispatcher";
import Channel from "../Chat/Channel";
import Chatter from "../Chat/Chatter";
import TickEvent from "../Application/TickEvent";

export type AdapterOptions = {
    identity: string,
    silent: boolean,
    channels: string[],
    [key: string]: any
}

export default abstract class Adapter extends Dispatcher {
    public run(options: AdapterOptions): void {
        setInterval(() => {
            this.dispatch(new TickEvent());
        }, 1000);
    }

    public abstract getName(): string;

    public abstract async sendMessage(message: string, channel: Channel);

    public abstract async sendAction(action: string, channel: Channel);

    public abstract async unbanChatter(chatter: Chatter);

    public abstract async banChatter(chatter: Chatter, reason?: string);

    public abstract async tempbanChatter(chatter: Chatter, length: number, reason?: string);
}