import Entity, {EntityParameters} from "./Entity";
import {Table} from "../Decorators/Table";
import {Column} from "../Decorators/Columns";
import {DataTypes} from "../Schema";
import {where} from "../BooleanOperations";

@Table(({service}) => `${service}_users`)
export default class UserEntity extends Entity<UserEntity> {
    constructor(id: number, params: EntityParameters) {
        super(UserEntity, id, params);
    }

    @Column({ name: "user_id", datatype: DataTypes.STRING, unique: true })
    public userId: string;

    @Column({ datatype: DataTypes.STRING })
    public name: string;

    @Column({ datatype: DataTypes.BOOLEAN })
    public ignore: boolean;

    public static findByName(params: EntityParameters, name: string): Promise<UserEntity|null> {
        return UserEntity.retrieve(params, where().eq("name", name));
    }
}

export type UserStateListItem<T> = [UserEntity, T];
export class UserStateList<T> {
    private readonly list: Map<string, T>;
    private readonly users: Map<string, UserEntity>;
    private readonly defVal: T;

    constructor(defVal: T) {
        this.list = new Map();
        this.users = new Map();
        this.defVal = defVal;
    }

    hasUser(user: UserEntity): boolean {
        return this.list.has(user.userId);
    }

    getUser(user: UserEntity): T {
        if (!this.hasUser(user))
            this.setUser(user, this.defVal);

        return this.list.get(user.userId);
    }

    setUser(user: UserEntity, value: T): void {
        this.list.set(user.userId, value);
        this.users.set(user.userId, user);
    }

    deleteUser(user: UserEntity): void {
        this.list.delete(user.userId);
    }

    size(): number {
        return this.list.size;
    }

    *entries(): Generator<UserStateListItem<T>, any, unknown> {
        for (const [ userId, user ] of this.users.entries())
            yield [user, this.list.get(userId)];
    }
}
