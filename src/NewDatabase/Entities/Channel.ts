import { Logger } from "log4js";
import { Column, Entity, ManyToOne, OneToMany, OneToOne } from "typeorm";
import { getLogger } from "../../Utilities/Logger";
import Optional from "../../Utilities/Patterns/Optional";
import { BadWord } from "./BadWord";
import { ChannelSettings } from "./ChannelSettings";
import { Chatter } from "./Chatter";
import { Command } from "./Command";
import { Counter } from "./Counter";
import CustomBaseEntity from "./CustomBaseEntity";
import { DisabledModule } from "./DisabledModule";
import { DomainFilter } from "./DomainFilter";
import { Group } from "./Group";
import { News } from "./News";
import { Permission } from "./Permission";
import { Service } from "./Service";
import { Trainer } from "./Trainer";

@Entity()
export class Channel extends CustomBaseEntity {
    @Column()
    nativeId: string;

    @Column()
    name: string;

    @Column({ default: 0 })
    commandIdCounter: number;

    @Column({ default: 0 })
    newsIdCounter: number;

    @OneToOne(() => ChannelSettings, channelSettings => channelSettings.channel)
    settings: ChannelSettings;

    @ManyToOne(() => Service, service => service.channels)
    service: Service;

    @OneToMany(() => Chatter, chatter => chatter.channel)
    chatters: Chatter[];

    get trainers(): Trainer[] {
        return this.chatters.map(chatter => chatter.trainer).filter(trainer => trainer);
    }

    findChatterByNativeId(nativeId: string): Optional<Chatter> {
        return Optional.ofUndefable(this.chatters.find(chatter => chatter.user.nativeId === nativeId));
    }

    findChatterByName(name: string): Optional<Chatter> {
        return Optional.ofUndefable(this.chatters.find(chatter => chatter.user.name === name));
    }

    @OneToMany(() => Group, group => group.channel)
    groups: Group[];

    @OneToMany(() => Permission, permission => permission.channel)
    permissions: Permission[];

    @OneToMany(() => Command, command => command.channel)
    commands: Command[];

    @OneToMany(() => Counter, counter => counter.channel)
    counters: Counter[];

    @OneToMany(() => DomainFilter, domainFilter => domainFilter.channel)
    domainFilters: DomainFilter[];

    @OneToMany(() => BadWord, badWord => badWord.channel)
    badWords: BadWord[]

    @OneToMany(() => DisabledModule, disabledModule => disabledModule.channel)
    disabledModules: DisabledModule[];

    @OneToMany(() => News, news => news.channel)
    newsItems: News[];

    get logger(): Logger {
        const logger = getLogger("Channel");
        logger.addContext("id", this.id);
        return logger;
    }
}