import Application from "../Application/Application";
import {Serializable} from "../Utilities/Serializable";

export default class User implements Serializable {
    protected ignore: boolean;
    private readonly user_id: string;
    private readonly name: string;

    constructor(user_id: string, name: string) {
        this.user_id = user_id;
        this.name = name;
        this.ignore = false;
    }

    static async findByName(username: string) {
        let row;
        try {
            row = await Application.getDatabase().table("users")
                .select().where().eq("name", username).done().first();
        } catch (e) {
            Application.getLogger().error("Unable to search for user in the database", { cause: e });
            return null;
        }

        if (row === null) return null;

        let user = new User(row.id, row.name);
        user.ignore = row.ignore;
        return user;
    }

    static deserialize(input: string) {
        let {user_id, name, ignore} = JSON.parse(input);
        let user = new User(user_id, name);
        user.ignore = ignore;
        return user;
    }

    getId() {
        return this.id;
    }

    getName() {
        return this.name;
    }

    isIgnored() {
        return this.ignore;
    }

    async setIgnore(value: boolean) {
        this.ignore = value;
        return this.save();
    }

    async exists(): Promise<boolean> {
        try {
            let count = await Application.getDatabase().table("users")
                .count().where().eq("user_id", this.getId()).done().exec();
            return count > 0;
        } catch (e) {
            Application.getLogger().error("Unable to verify the existence of the user in the database", {cause: e});
            return false;
        }
    }

    async save(): Promise<void> {
        await Application.getDatabase().table("users")
            .insert({
                id: this.getId(),
                name: this.getName(),
                ignore: this.ignore
            }).or("REPLACE").exec()
            .catch(e => Application.getLogger().error("Unable to save user data to database", { cause: e }));
    }

    async load(): Promise<void> {
        let row;
        try {
            row = await Application.getDatabase().table("users")
                .select().where().eq("name", this.name).done().first();
        } catch (e) {
            Application.getLogger().error("Unable to load user data from the database", { cause: e });
            return;
        }

        if (row === null) return;

        this.ignore = row.ignore;
    }

    serialize(): string {
        return JSON.stringify({
            user_id: this.user_id,
            name: this.name,
            ignore: this.ignore
        });
    }
}

export type UserStateListItem<T> = [User, T];
export class UserStateList<T> {
    private readonly list: Map<string, T>;
    private readonly users: Map<string, User>;
    private readonly defVal: T;

    constructor(defVal: T) {
        this.list = new Map();
        this.users = new Map();
        this.defVal = defVal;
    }

    hasUser(user: User) {
        return this.list.has(user.getId());
    }

    getUser(user: User): T {
        if (!this.hasUser(user))
            this.setUser(user, this.defVal);

        return this.list.get(user.getId());
    }

    setUser(user: User, value: T) {
        this.list.set(user.getId(), value);
        this.users.set(user.getId(), user);
    }

    deleteUser(user: User) {
        this.list.delete(user.getId());
    }

    size() {
        return this.list.size
    }

    *entries(): Generator<UserStateListItem<T>, any, unknown> {
        for (let [ user_id, user ] of this.users.entries())
            yield [user, this.list.get(user_id)];
    }
}
