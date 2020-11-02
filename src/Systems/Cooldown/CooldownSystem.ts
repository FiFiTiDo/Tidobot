import Command from "../Commands/Command";
import { Command as CommandEntity } from "../../Database/Entities/Command";
import Message from "../../Chat/Message";
import Cooldown from "./Cooldown";
import CooldownList from "./CooldownList";
import { Service } from "typedi";
import { EntityStateList } from "../../Database/EntityStateLiist";
import { Channel } from "../../Database/Entities/Channel";
import { Chatter } from "../../Database/Entities/Chatter";

@Service()
export default class CooldownSystem {
    private static instance: CooldownSystem = null;
    private globalCooldowns = new EntityStateList<Channel, CooldownList>(() => new CooldownList());
    private chatterCooldowns = new EntityStateList<Chatter, CooldownList>(() => new CooldownList());

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