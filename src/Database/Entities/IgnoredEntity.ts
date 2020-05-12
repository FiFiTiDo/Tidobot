import Entity, {EntityParameters} from "./Entity";
import {Table} from "../Decorators/Table";
import {Column, DataTypes, Id} from "../Decorators/Columns";
import {where} from "../Where";

@Id
@Table(({service}) => `${service}_ignored`)
export default class IgnoredEntity extends Entity<IgnoredEntity> {
    @Column({name: "user_id", datatype: DataTypes.STRING, unique: true})
    public userId: string;

    constructor(id: number, params: EntityParameters) {
        super(IgnoredEntity, id, params);
    }

    public static findByChatter(service: string, userId: string): Promise<IgnoredEntity | null> {
        return IgnoredEntity.retrieve({service}, where().eq("user_id", userId));
    }

    public static isIgnored(service: string, userId: string): Promise<boolean> {
        return this.findByChatter(service, userId).then(entity => entity != null);
    }

    public static async add(service: string, userId: string): Promise<boolean> {
        return this.make({service}, {user_id: userId}).then(entity => entity !== null);
    }

    public static async remove(service: string, userId: string): Promise<boolean> {
        const entity = await this.findByChatter(service, userId);
        if (entity === null) return false;
        await entity.delete();
        return true;
    }
}