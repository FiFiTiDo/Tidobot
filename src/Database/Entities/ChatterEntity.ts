import {EntityParameters} from "./Entity";
import {Table} from "../Decorators/Table";
import {Column, DataTypes, Id} from "../Decorators/Columns";
import GroupsEntity from "./GroupsEntity";
import {ManyToMany, OneToMany} from "../Decorators/Relationships";
import GroupMembersEntity from "./GroupMembersEntity";
import UserPermissionsEntity from "./UserPermissionsEntity";
import {where} from "../Where";
import ChannelEntity, {ChannelStateList} from "./ChannelEntity";
import Permission from "../../Systems/Permissions/Permission";
import ChannelSpecificEntity from "./ChannelSpecificEntity";
import IgnoredEntity from "./IgnoredEntity";

@Id
@Table(({service, channel}) => `${service}_${channel.name}_chatters`)
export default class ChatterEntity extends ChannelSpecificEntity<ChatterEntity> {
    constructor(id: number, params: EntityParameters) {
        super(ChatterEntity, id, params);
    }

    @Column({ name: "user_id", datatype: DataTypes.STRING, unique: true })
    public userId: string;

    @Column({ datatype: DataTypes.STRING })
    public name: string;

    @Column({ datatype: DataTypes.FLOAT })
    public balance: number;

    @Column({ datatype: DataTypes.BOOLEAN })
    public banned: boolean;

    @Column({ datatype: DataTypes.BOOLEAN })
    public regular: boolean;

    @ManyToMany(GroupsEntity, GroupMembersEntity, "user_id", "user_id", "id", "group_id")
    public async groups(): Promise<GroupsEntity[]> { return []; }

    @OneToMany(UserPermissionsEntity, "user_id", "user_id")
    public async permissions(): Promise<UserPermissionsEntity[]> { return []; }

    public async hasPermission(perm: Permission): Promise<boolean> {
        for (const permission of await this.permissions())
            if (permission.permission === perm.getPermission())
                return permission.allowed;

        const groups = await this.groups();
        if (groups.length < 1) return false;

        for (const group of groups)
            if (!(await group.hasPermission(perm)))
                return false;
        return true;
    }

    public async withdraw(amount: number): Promise<void> {
        this.balance -= amount;
        return this.save();
    }

    public async deposit(amount: number): Promise<void> {
        this.balance += amount;
        return this.save();
    }

    public async charge(amount: number): Promise<boolean> {
        if (amount > this.balance) return false;
        this.balance -= amount;
        await this.save();
        return true;
    }

    public isIgnored(): Promise<boolean> {
        return IgnoredEntity.isIgnored(this.getService(), this.userId);
    }

    public static async findById(id: string, channel: ChannelEntity): Promise<ChatterEntity|null> {
        return ChatterEntity.retrieve({ channel }, where().eq("user_id", id));
    }

    public static async findByName(name: string, channel: ChannelEntity): Promise<ChatterEntity|null> {
        return ChatterEntity.retrieve({ channel }, where().eq("name", name));
    }

    public static async from(userId: string, name: string, channel: ChannelEntity): Promise<ChatterEntity|null> {
        return this.retrieveOrMake({ channel }, where().eq("user_id", userId), { user_id: userId, name, balance: 0.0, banned: 0, regular: 0 });
    }
}
export type ChatterStateListItem<T> = [ChatterEntity, T];
export class ChatterStateList<T> {
    private readonly list: ChannelStateList<{ [key: string]: T }>;
    private readonly users: Map<string, ChatterEntity>;

    constructor(private readonly defVal: T) {
        this.list = new ChannelStateList({});
        this.users = new Map();
    }

    hasChatter(chatter: ChatterEntity): boolean {
        return Object.prototype.hasOwnProperty.call(this.list.getChannel(chatter.getChannel()), chatter.userId);
    }

    getChatter(chatter: ChatterEntity): T {
        if (!this.hasChatter(chatter))
            this.setChatter(chatter, this.defVal);

        return this.list.getChannel(chatter.getChannel())[chatter.userId];
    }

    setChatter(chatter: ChatterEntity, value: T): void {
        this.list.getChannel(chatter.getChannel())[chatter.userId] = value;
        this.users.set(chatter.userId, chatter);
    }

    removeChatter(chatter: ChatterEntity): void {
        delete this.list.getChannel(chatter.getChannel())[chatter.userId];
    }

    size(channel: ChannelEntity): number {
        return Object.keys(this.list.getChannel(channel)).length;
    }

    *entries(channel: ChannelEntity): Generator<ChatterStateListItem<T>, any, unknown> {
        for (const [ user_id, num ] of Object.entries(this.list.getChannel(channel))) {
            yield [this.users.get(user_id), num];
        }
    }

    clear(channel: ChannelEntity): void {
        this.list.deleteChannel(channel);
    }
}