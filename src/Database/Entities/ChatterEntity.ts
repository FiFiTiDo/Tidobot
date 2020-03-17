import Entity from "./Entity";
import {DataTypes} from "../Schema";
import {Table} from "../Decorators/Table";
import {Column} from "../Decorators/Columns";
import GroupsEntity from "./GroupsEntity";
import {ManyToMany, OneToMany} from "../Decorators/Relationships";
import GroupMembersEntity from "./GroupMembersEntity";
import UserPermissionsEntity from "./UserPermissionsEntity";

@Table((service, channel) => `${service}_${channel}_chatters`)
export default class ChatterEntity extends Entity {
    constructor(id: number, service?: string, channel?: string) {
        super(ChatterEntity, id, service, channel);
    }

    @Column({ datatype: DataTypes.STRING, unique: true })
    public user_id: string;

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

    public async hasPermission(perm_str: string) {
        for (let permission of await this.permissions())
            if (permission.permission === perm_str)
                return permission.allowed;

        let groups = await this.groups();
        if (groups.length < 1) return false;

        for (let group of groups)
            if (!(await group.hasPermission(perm_str)))
                return false;
        return true;
    }

    public async withdraw(amount: number) {
        this.balance -= amount;
        return this.save();
    }

    public async deposit(amount: number) {
        this.balance += amount;
        return this.save();
    }

    public async charge(amount: number): Promise<boolean> {
        if (amount > this.balance) return false;
        this.balance -= amount;
        await this.save();
        return true;
    }
}