import Dispatcher from "../Systems/Event/Dispatcher";
import TickEvent from "../Application/TickEvent";
import ChannelEntity from "../Database/Entities/ChannelEntity";
import ChatterEntity from "../Database/Entities/ChatterEntity";
import EventSystem from "../Systems/Event/EventSystem";

export type AdapterOptions = {
    identity: string;
    silent: boolean;
    channels: string[];
    [key: string]: any;
}

export default abstract class Adapter extends Dispatcher {
    public run(options: AdapterOptions): void {
        setInterval(() => {
            EventSystem.getInstance().dispatch(new TickEvent());
        }, 1000);
    }

    public abstract getName(): string;

    public abstract async sendMessage(message: string, channel: ChannelEntity);

    public abstract async sendAction(action: string, channel: ChannelEntity);

    public abstract async unbanChatter(chatter: ChatterEntity);

    public abstract async banChatter(chatter: ChatterEntity, reason?: string);

    public abstract async tempbanChatter(chatter: ChatterEntity, length: number, reason?: string);
}