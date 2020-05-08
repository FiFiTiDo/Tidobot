import ChannelEntity from "../Database/Entities/ChannelEntity";
import {array_contains, array_remove} from "../Utilities/ArrayUtils";
import {injectable, unmanaged} from "inversify";

@injectable()
export default abstract class AbstractModule {
    protected coreModule = false;
    private readonly name: string;

    protected constructor(@unmanaged() name: string) {
        this.name = name;
    }

    public initialize(): void {
        // Not implemented
    }

    getName(): string {
        return this.name;
    }

    async disable(channel: ChannelEntity): Promise<void> {
        if (this.coreModule) return;
        if (this.isDisabled(channel)) return;
        channel.disabledModules.push(this.getName());
        return channel.save();
    }

    async enable(channel: ChannelEntity): Promise<void> {
        if (this.coreModule) return;
        if (!this.isDisabled(channel)) return;
        array_remove(this.getName(), channel.disabledModules);
        return channel.save();
    }

    isDisabled(channel: ChannelEntity): boolean {
        return !this.coreModule && array_contains(this.getName(), channel.disabledModules);
    }
}