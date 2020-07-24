import TickEvent from "../Application/TickEvent";
import ChannelEntity from "../Database/Entities/ChannelEntity";
import ChatterEntity from "../Database/Entities/ChatterEntity";
import EventSystem from "../Systems/Event/EventSystem";
import {injectable} from "inversify";
import TimerSystem, {TimeUnit} from "../Systems/Timer/TimerSystem";

export type AdapterOptions = {
    identity: string;
    silent: boolean;
    channels: string[];
    [key: string]: any;
}

@injectable()
export default abstract class Adapter {
    public run(options: AdapterOptions): void {
        TimerSystem.getInstance().startTimer(() => EventSystem.getInstance().dispatch(new TickEvent()), TimeUnit.Seconds(1));
    }

    public abstract stop(): void | Promise<void>;

    public abstract getName(): string;

    public abstract async sendMessage(message: string, channel: ChannelEntity);

    public abstract async sendAction(action: string, channel: ChannelEntity);

    public abstract async unbanChatter(chatter: ChatterEntity);

    public abstract async banChatter(chatter: ChatterEntity, reason?: string);

    public abstract async tempbanChatter(chatter: ChatterEntity, length: number, reason?: string);
}