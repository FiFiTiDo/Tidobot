import Command from "../Commands/Command";
import CommandEntity from "../../Database/Entities/CommandEntity";
import Message from "../../Chat/Message";
import ChannelEntity from "../../Database/Entities/ChannelEntity";
import Cooldown from "./Cooldown";
import ChatterEntity from "../../Database/Entities/ChatterEntity";
import CooldownList from "./CooldownList";
import EntityStateList from "../../Database/EntityStateList";
import { Service } from "typedi";

@Service()
export default class CooldownSystem {
    private static instance: CooldownSystem = null;
    private globalCooldowns = new EntityStateList<ChannelEntity, CooldownList>(() => new CooldownList());
    private chatterCooldowns = new EntityStateList<ChatterEntity, CooldownList>(() => new CooldownList());

    public static getInstance(): CooldownSystem {
        if (this.instance === null)
            this.instance = new CooldownSystem();

        return this.instance;
    }

    public check(msg: Message, command: Command | CommandEntity, subcommand?: string): boolean {
        const global = this.globalCooldowns.get(msg.getChannel()).find(command, subcommand);
        const chatter = this.chatterCooldowns.get(msg.getChatter()).find(command, subcommand);

        return (global === null || global.check()) && (chatter === null || chatter.check());
    }

    public add(msg: Message, command: Command | CommandEntity, subcommand?: string): void {
        this.globalCooldowns.get(msg.getChannel()).replace(new Cooldown(command, subcommand, false));
        this.chatterCooldowns.get(msg.getChatter()).replace(new Cooldown(command, subcommand, true));
    }
}