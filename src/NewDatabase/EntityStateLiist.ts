import { Resolvable, resolve } from "../Utilities/Interfaces/Resolvable";
import CustomBaseEntity from "./Entities/CustomBaseEntity";

export class EntityStateList<EntityT extends CustomBaseEntity, ValueT> {
    private readonly entityMap: { [key: number]: EntityT } = {};
    private valueMap: { [key: number]: ValueT } = {};

    constructor(private defVal: Resolvable<EntityT, ValueT>) {
    }

    public has(entity: EntityT): boolean {
        return Object.prototype.hasOwnProperty.call(this.valueMap, entity.id);
    }

    public get(entity: EntityT): ValueT {
        if (!this.has(entity)) this.set(entity, resolve(this.defVal));
        return this.valueMap[entity.id];
    }

    public set(entity: EntityT, value: ValueT): void {
        this.valueMap[entity.id] = value;
        this.entityMap[entity.id] = entity;
    }

    public delete(entity: EntityT) {
        delete this.valueMap[entity.id];
        delete this.entityMap[entity.id];
    }

    public entities(): EntityT[] {
        return Object.values(this.entityMap);
    }

    public values(): ValueT[] {
        return Object.values(this.valueMap);
    }

    public entries(): [EntityT, ValueT][] {
        return Object.entries(this.valueMap).map(([id, value]) => [this.entityMap[id], value]);
    }

    public clear(): void {
        this.valueMap = {};
    }

    public filter(f: (id: number, entity: EntityT, value: ValueT) => boolean) {
        const ids = Object.keys(this.entityMap) as unknown as number[];
        for (const id of ids) {
            if (!f(id, this.entityMap[id], this.valueMap[id])) {
                delete this.valueMap[id];
                delete this.entityMap[id];
            }
        }
    }

    public getAll(filter: (entry?: [EntityT, ValueT], index?: number) => boolean = () => true): [EntityT, ValueT][] {
        return this.entries().filter(filter)
    }

    size(filter: (entry?: [EntityT, ValueT], index?: number) => boolean = () => true) {
        return this.getAll(filter).length;
    }
}