import {EntityParameters} from "./Entity";
import {Table} from "../Decorators/Table";
import {Column, DataTypes, Id} from "../Decorators/Columns";
import GroupsEntity from "./GroupsEntity";
import {ManyToMany, OneToMany} from "../Decorators/Relationships";
import GroupMembersEntity from "./GroupMembersEntity";
import UserPermissionsEntity from "./UserPermissionsEntity";
import {where} from "../Where";
import ChannelEntity from "./ChannelEntity";
import Permission from "../../Systems/Permissions/Permission";
import ChannelSpecificEntity from "./ChannelSpecificEntity";
import IgnoredEntity from "./IgnoredEntity";
import CurrencyModule from "../../Modules/CurrencyModule";

@Id
@Table(({service, channel}) => `${service}_${channel.name}_chatters`)
export default class ChatterEntity extends ChannelSpecificEntity<ChatterEntity> {
    @Column({name: "user_id", datatype: DataTypes.STRING, unique: true})
    public userId: string;
    @Column({datatype: DataTypes.STRING})
    public name: string;
    @Column({datatype: DataTypes.FLOAT})
    public balance: number;
    @Column({datatype: DataTypes.BOOLEAN})
    public banned: boolean;
    @Column({datatype: DataTypes.BOOLEAN})
    public regular: boolean;

    constructor(id: number, params: EntityParameters) {
        super(ChatterEntity, id, params);
    }

    public static async findById(id: string, channel: ChannelEntity): Promise<ChatterEntity | null> {
        return ChatterEntity.retrieve({channel}, where().eq("user_id", id));
    }

    public static async findByName(name: string, channel: ChannelEntity): Promise<ChatterEntity | null> {
        return ChatterEntity.retrieve({channel}, where().eq("name", name));
    }

    public static async from(userId: string, name: string, channel: ChannelEntity): Promise<ChatterEntity | null> {
        return this.retrieveOrMake({channel}, where().eq("user_id", userId), {
            user_id: userId,
            name,
            balance: 0.0,
            banned: 0,
            regular: 0
        });
    }

    public async getFormattedBalance() {
        return await CurrencyModule.formatAmount(this.balance, this.getChannel());
    }

    @ManyToMany(GroupsEntity, GroupMembersEntity, "user_id", "user_id", "id", "group_id")
    public async groups(): Promise<GroupsEntity[]> {
        return [];
    }

    @OneToMany(UserPermissionsEntity, "user_id", "user_id")
    public async permissions(): Promise<UserPermissionsEntity[]> {
        return [];
    }

    public async hasPermission(perm: Permission): Promise<boolean> {
        for (const permission of await this.permissions())
            if (permission.permission === perm.getToken())
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
}

export const filterByChannel = (channel: ChannelEntity) => ([chatter, _]: [ChatterEntity, any]) => chatter.getChannel().is(channel);
